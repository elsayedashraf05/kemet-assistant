import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import {
  Heart, MessageCircle, Bookmark, Camera, MapPin, Send,
  Search, Sparkles, Globe, Filter, Image as ImageIcon, X,
  Loader2, AlertCircle, Trash2, User as UserIcon, Trophy,
} from "lucide-react";
import { API_BASE_URL } from "../lib/api";

// Same backend the Account page talks to.
const API_BASE = API_BASE_URL;
const TOKEN_KEY = "kemet_token";
const GUEST_NAME_KEY = "kemet_guest_name";

const AVATAR_COLORS = [
  "from-yellow-400 to-orange-500",
  "from-blue-400 to-purple-500",
  "from-green-400 to-teal-500",
  "from-pink-400 to-rose-500",
  "from-indigo-400 to-blue-500",
  "from-amber-400 to-yellow-500",
];

function gradientFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initialsFor(name: string) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function timeAgo(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

// --- Identity helpers (shared with Account.tsx via localStorage) ---

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function getGuestName(): string {
  return localStorage.getItem(GUEST_NAME_KEY) || "";
}
function setGuestName(name: string) {
  localStorage.setItem(GUEST_NAME_KEY, name);
}
function getCurrentIdentity(): { name: string; loggedIn: boolean } {
  const token = getToken();
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload?.username) return { name: payload.username, loggedIn: true };
    } catch {
      /* fall through to guest */
    }
  }
  return { name: getGuestName(), loggedIn: false };
}

async function accountApiRequest(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/account${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// Same endpoint Account.tsx uses to get the real profile_pic_url — this is
// the authoritative source (set via avatar upload), unlike the JWT payload
// which only carries the username.
const apiAccountMe = () => accountApiRequest("/me").then((d) => d.user as { username: string; email: string; profile_pic_url: string });

// --- API layer ---

interface Comment {
  author: string;
  text: string;
  timestamp: string;
}

interface Post {
  owner_username: string;
  content_index: number;
  text: string;
  image_url: string | null;
  timestamp: string;
  profile_pic_url: string;
  likes: number;
  liked_by_me: boolean;
  saves: number;
  saved_by_me: boolean;
  comments: Comment[];
  comments_count: number;
}

async function postsApiRequest(path: string, options: RequestInit = {}) {
  const token = getToken();
  const guestName = getGuestName();
  const res = await fetch(`${API_BASE}/api/posts${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!token && guestName ? { "X-Guest-Name": guestName } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

const apiListPosts = () => postsApiRequest("").then((d) => d.posts as Post[]);

// Module-level cache: lives outside React state, so it survives the
// Community component unmounting/remounting (e.g. switching to Account and
// back). We show cached data instantly with no spinner, then silently
// re-fetch in the background to keep it fresh. It only resets on a full
// browser reload — that's intentional, it's a session cache, not storage.
let cachedPosts: Post[] | null = null;

const apiCreatePost = (text: string, file: File | null) => {
  const formData = new FormData();
  formData.append("text", text);
  if (file) formData.append("file", file);
  return postsApiRequest("", { method: "POST", body: formData }).then((d) => d.post as Post);
};

const apiToggleLike = (owner: string, idx: number) =>
  postsApiRequest(`/${owner}/${idx}/like`, { method: "POST" }) as Promise<{ liked_by_me: boolean; likes: number }>;

const apiToggleSave = (owner: string, idx: number) =>
  postsApiRequest(`/${owner}/${idx}/save`, { method: "POST" }) as Promise<{ saved_by_me: boolean; saves: number }>;

const apiComment = (owner: string, idx: number, text: string) =>
  postsApiRequest(`/${owner}/${idx}/comment`, {
    method: "POST",
    body: JSON.stringify({ text }),
  }) as Promise<{ comment: Comment; comments_count: number }>;

const apiDeletePost = (owner: string, idx: number) =>
  postsApiRequest(`/${owner}/${idx}`, { method: "DELETE" });

// --- Small shared UI bits ---

function Avatar({ name, imageUrl, size = "md" }: { name: string; imageUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
  if (imageUrl) {
    return <img src={imageUrl} alt={name} loading="lazy" decoding="async" className={`${sizes[size]} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${gradientFor(name)} flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initialsFor(name)}
    </div>
  );
}

/** Asks a guest (once) for the name they want to post/react/comment/save under.
 * Logged-in users never see this — their account name is used automatically. */
function GuestNameModal({ onSubmit, onCancel }: { onSubmit: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(getGuestName());
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#12152B] border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <UserIcon size={16} style={{ color: "#D4AF37" }} />
            What's your name?
          </h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-white/50">
          You're not signed in. Enter a name to post and interact as a guest — you'll see this again only if you clear it.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onSubmit(name.trim())}
          placeholder="Your name"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]/40 transition-colors"
        />
        <button
          onClick={() => name.trim() && onSubmit(name.trim())}
          disabled={!name.trim()}
          className="w-full py-2.5 rounded-xl font-semibold text-sm bg-[#D4AF37] text-black hover:bg-[#C9A84C] transition-all disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

const PostCard = memo(function PostCard({
  post, identity, myProfilePicUrl, onChanged, onDeleted, requireIdentity,
}: {
  post: Post;
  identity: { name: string; loggedIn: boolean };
  myProfilePicUrl: string | null;
  onChanged: (updated: Post) => void;
  onDeleted: (owner: string, idx: number) => void;
  requireIdentity: (action: () => void) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);
  const isOwn = identity.name !== "" && identity.name === post.owner_username;

  const like = () =>
    requireIdentity(() => {
      // Flip instantly so the tap feels immediate — the network call
      // happens in the background and only corrects things on failure.
      const optimisticLiked = !post.liked_by_me;
      const optimisticLikes = post.likes + (optimisticLiked ? 1 : -1);
      onChanged({ ...post, liked_by_me: optimisticLiked, likes: optimisticLikes });
      apiToggleLike(post.owner_username, post.content_index)
        .then((res) => onChanged({ ...post, liked_by_me: res.liked_by_me, likes: res.likes }))
        .catch(() => onChanged({ ...post, liked_by_me: post.liked_by_me, likes: post.likes }));
    });

  const save = () =>
    requireIdentity(() => {
      const optimisticSaved = !post.saved_by_me;
      const optimisticSaves = post.saves + (optimisticSaved ? 1 : -1);
      onChanged({ ...post, saved_by_me: optimisticSaved, saves: optimisticSaves });
      apiToggleSave(post.owner_username, post.content_index)
        .then((res) => onChanged({ ...post, saved_by_me: res.saved_by_me, saves: res.saves }))
        .catch(() => onChanged({ ...post, saved_by_me: post.saved_by_me, saves: post.saves }));
    });

  const submitComment = () => {
    if (!commentText.trim()) return;
    requireIdentity(async () => {
      setBusy(true);
      try {
        const res = await apiComment(post.owner_username, post.content_index, commentText.trim());
        onChanged({ ...post, comments: [...post.comments, res.comment], comments_count: res.comments_count });
        setCommentText("");
      } catch {
        /* ignore */
      } finally {
        setBusy(false);
      }
    });
  };

  const remove = async () => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await apiDeletePost(post.owner_username, post.content_index);
      onDeleted(post.owner_username, post.content_index);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="bg-[#12152B] border border-white/10 rounded-2xl overflow-hidden hover:border-[#D4AF37]/20 transition-colors duration-300"
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 400px" }}
    >
      {/* Header */}
      <div className="p-5 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={post.owner_username} imageUrl={post.profile_pic_url} size="md" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white text-sm">{post.owner_username}</span>
            </div>
            <span className="text-xs text-gray-500">{timeAgo(post.timestamp)}</span>
          </div>
        </div>
        {isOwn && (
          <button onClick={remove} className="text-gray-500 hover:text-red-400 transition-colors" title="Delete post">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Content */}
      {post.text && (
        <div className="px-5 pb-3">
          <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{post.text}</p>
        </div>
      )}

      {/* Image */}
      {post.image_url && (
        <div className="mx-5 mb-4 rounded-xl overflow-hidden">
          <img
            src={post.image_url}
            alt="post"
            loading="lazy"
            decoding="async"
            className="w-full max-h-[420px] object-cover"
          />
        </div>
      )}

      {/* Stats bar */}
      <div className="px-5 py-2 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
        <span>{post.likes.toLocaleString()} likes</span>
        <div className="flex gap-3">
          <button onClick={() => setShowComments(!showComments)} className="hover:text-gray-300 transition-colors">
            {post.comments_count} comments
          </button>
          <span>{post.saves} saves</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-5 py-2 border-t border-white/5 flex items-center justify-between">
        <button
          onClick={like}
          className={`flex items-center gap-1.5 text-sm font-medium transition-all px-3 py-1.5 rounded-lg ${
            post.liked_by_me ? "text-rose-400 bg-rose-400/10" : "text-gray-400 hover:text-rose-400 hover:bg-rose-400/10"
          }`}
        >
          <Heart size={16} fill={post.liked_by_me ? "currentColor" : "none"} />
          Like
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 transition-all px-3 py-1.5 rounded-lg"
        >
          <MessageCircle size={16} />
          Comment
        </button>
        <button
          onClick={save}
          className={`flex items-center gap-1.5 text-sm font-medium transition-all px-3 py-1.5 rounded-lg ${
            post.saved_by_me ? "text-[#D4AF37] bg-[#D4AF37]/10" : "text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10"
          }`}
        >
          <Bookmark size={16} fill={post.saved_by_me ? "currentColor" : "none"} />
          Save
        </button>
      </div>

      {/* Latest 2 comments — visible without expanding anything */}
      {!showComments && post.comments.length > 0 && (
        <div className="border-t border-white/5 px-5 py-3 space-y-3">
          {post.comments.slice(-2).map((c, idx) => (
            <div key={idx} className="flex gap-2">
              <Avatar name={c.author} size="sm" />
              <div className="flex-1 bg-white/5 rounded-xl px-3 py-2">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-white">{c.author}</span>
                  <span className="text-xs text-gray-500">{timeAgo(c.timestamp)}</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{c.text}</p>
              </div>
            </div>
          ))}
          {post.comments_count > 2 && (
            <button
              onClick={() => setShowComments(true)}
              className="text-xs font-medium text-[#D4AF37] hover:opacity-80 transition-opacity pl-10"
            >
              View all {post.comments_count} comments
            </button>
          )}
        </div>
      )}

      {/* Full comments thread + reply box */}
      {showComments && (
        <div className="border-t border-white/10 bg-white/3 px-5 py-4 space-y-4">
          {post.comments.length === 0 && (
            <p className="text-xs text-gray-500">No comments yet — be the first.</p>
          )}
          {post.comments.map((c, idx) => (
            <div key={idx} className="flex gap-3">
              <Avatar name={c.author} size="sm" />
              <div className="flex-1 bg-white/5 rounded-xl px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-white">{c.author}</span>
                  <span className="text-xs text-gray-500">{timeAgo(c.timestamp)}</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{c.text}</p>
              </div>
            </div>
          ))}

          <div className="flex gap-3 mt-2">
            <Avatar name={identity.name || "?"} imageUrl={myProfilePicUrl} size="sm" />
            <div className="flex-1 flex gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitComment()}
                placeholder="Share your thoughts..."
                className="flex-1 bg-white/10 border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
              />
              <button
                onClick={submitComment}
                disabled={!commentText.trim() || busy}
                className="w-8 h-8 rounded-full bg-[#D4AF37] text-black flex items-center justify-center hover:bg-[#C9A84C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 self-center"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export function Community() {
  const [posts, setPosts] = useState<Post[]>(cachedPosts ?? []);
  const [loading, setLoading] = useState(cachedPosts === null);
  const [loadError, setLoadError] = useState("");
  const [identity, setIdentity] = useState(getCurrentIdentity());

  const [composerOpen, setComposerOpen] = useState(false);
  const [newPostText, setNewPostText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"Latest" | "Photos">("Latest");

  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const loadPosts = async () => {
    // Only show the big spinner the very first time, when there's no
    // cached data yet. On every later visit we already have something on
    // screen, so we just refresh quietly behind the scenes.
    if (cachedPosts === null) setLoading(true);
    setLoadError("");
    try {
      const data = await apiListPosts();
      cachedPosts = data;
      setPosts(data);
    } catch (e) {
      // If we have stale cached data, keep showing it rather than
      // replacing the feed with an error on a background refresh failure.
      if (cachedPosts === null) {
        setLoadError(e instanceof Error ? e.message : "Failed to load posts.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Runs `action` immediately if we already know who's posting (logged in,
  // or a guest name was typed before). Otherwise asks for a name first.
  const requireIdentity = useCallback((action: () => void) => {
    const current = getCurrentIdentity();
    setIdentity(current);
    if (current.name) {
      action();
    } else {
      setPendingAction(() => action);
    }
  }, []);

  const handleGuestNameSubmit = (name: string) => {
    setGuestName(name);
    setIdentity({ name, loggedIn: false });
    setPendingAction(null);
    pendingAction?.();
  };

  // Every mutation goes through this so the module-level cache and the
  // on-screen list never drift apart from each other.
  const applyPosts = useCallback((updater: (prev: Post[]) => Post[]) => {
    setPosts((prev) => {
      const next = updater(prev);
      cachedPosts = next;
      return next;
    });
  }, []);

  const updatePostInList = useCallback(
    (updated: Post) =>
      applyPosts((prev) =>
        prev.map((p) =>
          p.owner_username === updated.owner_username && p.content_index === updated.content_index ? updated : p
        )
      ),
    [applyPosts]
  );

  const removePostFromList = useCallback(
    (owner: string, idx: number) =>
      applyPosts((prev) => prev.filter((p) => !(p.owner_username === owner && p.content_index === idx))),
    [applyPosts]
  );

  const publishPost = () => {
    if (!newPostText.trim() && !uploadFile) return;
    requireIdentity(async () => {
      setPublishing(true);
      setPublishError("");
      try {
        const post = await apiCreatePost(newPostText.trim(), uploadFile);
        applyPosts((prev) => [post, ...prev]);
        setNewPostText("");
        setUploadFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setComposerOpen(false);
      } catch (e) {
        setPublishError(e instanceof Error ? e.message : "Failed to publish post.");
      } finally {
        setPublishing(false);
      }
    });
  };

  const filteredPosts = posts.filter((p) => {
    if (activeFilter === "Photos" && !p.image_url) return false;
    if (!searchQuery) return true;
    return p.owner_username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // `identity` only carries {name, loggedIn} straight from the JWT — it never
  // had a profile picture. So every "this is me" avatar (composer, comment
  // box) was always falling back to initials, even for users who *do* have a
  // profile pic. We fetch the real one from /api/account/me — the same
  // authoritative source Account.tsx uses (set via avatar upload) — rather
  // than guessing from posts, since a user with no posts yet would have no
  // way to surface their picture that way.
  const [myProfilePicUrl, setMyProfilePicUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!identity.loggedIn) {
      setMyProfilePicUrl(null);
      return;
    }
    let cancelled = false;
    apiAccountMe()
      .then((u) => { if (!cancelled) setMyProfilePicUrl(u.profile_pic_url || null); })
      .catch(() => { if (!cancelled) setMyProfilePicUrl(null); });
    return () => { cancelled = true; };
  }, [identity.loggedIn, identity.name]);

  // Top 10 most active travelers, ranked purely by how many posts they've
  // shared — real data straight from what's already loaded, no fake numbers.
  const topTravelers = useMemo(() => {
    const counts = new Map<string, { count: number; profile_pic_url: string }>();
    for (const p of posts) {
      const existing = counts.get(p.owner_username);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(p.owner_username, { count: 1, profile_pic_url: p.profile_pic_url });
      }
    }
    return Array.from(counts.entries())
      .map(([username, data]) => ({ username, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [posts]);

  return (
    <div className="space-y-6">
      {pendingAction && (
        <GuestNameModal onSubmit={handleGuestNameSubmit} onCancel={() => setPendingAction(null)} />
      )}

      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-white/10">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1754400534733-06ba59423253?w=1600&q=80)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0B1E]/95 via-[#0A0B1E]/70 to-transparent" />
        <div className="relative px-8 py-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="text-[#D4AF37]" size={20} />
            <span className="text-[#D4AF37] text-sm font-medium tracking-wider uppercase">Traveler Community</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Share Your Egypt Story</h1>
          <p className="text-gray-300 max-w-xl mb-6">
            Connect with fellow explorers, share your experiences, discover hidden gems, and inspire the next generation of Egypt travelers.
          </p>
          <button
            onClick={() => setComposerOpen(true)}
            className="px-6 py-3 bg-[#D4AF37] hover:bg-[#C9A84C] text-black font-semibold rounded-xl transition-all shadow-lg shadow-[#D4AF37]/20 flex items-center gap-2"
          >
            <Camera size={18} />
            Share Your Experience
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feed - left/main */}
        <div className="lg:col-span-2 space-y-5">
          {/* Search + filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search travelers..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]/40 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-gray-400 flex-shrink-0" />
              {(["Latest", "Photos"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    activeFilter === f ? "bg-[#D4AF37] text-black" : "bg-white/10 text-gray-400 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Compose teaser (collapsed) */}
          {!composerOpen && (
            <button
              onClick={() => setComposerOpen(true)}
              className="w-full bg-white/5 border border-white/10 hover:border-[#D4AF37]/30 rounded-2xl p-4 flex items-center gap-3 transition-all group text-left"
            >
              <Avatar name={identity.name || "?"} imageUrl={myProfilePicUrl} size="md" />
              <span className="text-gray-500 group-hover:text-gray-400 text-sm transition-colors flex-1">
                {"What's your Egypt story? Share it with the community..."}
              </span>
              <Camera size={18} className="text-gray-500 group-hover:text-[#D4AF37] transition-colors" />
            </button>
          )}

          {/* Compose expanded */}
          {composerOpen && (
            <div className="bg-white/5 backdrop-blur-sm border border-[#D4AF37]/30 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={identity.name || "?"} imageUrl={myProfilePicUrl} size="md" />
                  <div>
                    <p className="text-sm font-semibold text-white">Share Your Experience</p>
                    <p className="text-xs text-gray-400">
                      {identity.loggedIn
                        ? `Posting as @${identity.name}`
                        : identity.name
                        ? `Posting as @${identity.name} (guest)`
                        : "Visible to all KEMET travelers"}
                    </p>
                  </div>
                </div>
                <button onClick={() => setComposerOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <textarea
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder="Describe your experience, tips, hidden gems, honest thoughts..."
                rows={4}
                maxLength={500}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]/40 transition-colors resize-none"
              />

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#D4AF37] transition-colors cursor-pointer">
                  <ImageIcon size={16} />
                  {uploadFile ? uploadFile.name : "Add photo"}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    className="hidden"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </label>
                {uploadFile && (
                  <button onClick={() => { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-xs text-gray-500 hover:text-red-400">
                    Remove
                  </button>
                )}
              </div>

              {publishError && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">
                  <AlertCircle size={14} />
                  {publishError}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className={`text-xs ${newPostText.length > 480 ? "text-rose-400" : "text-gray-500"}`}>
                  {newPostText.length}/500
                </span>
                <button
                  onClick={publishPost}
                  disabled={(!newPostText.trim() && !uploadFile) || publishing}
                  className="px-5 py-2 bg-[#D4AF37] hover:bg-[#C9A84C] text-black text-sm font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Publish
                </button>
              </div>
            </div>
          )}

          {/* Posts feed */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-[#D4AF37]" />
            </div>
          ) : loadError ? (
            <div className="text-center py-16 text-red-400 text-sm">{loadError}</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Globe size={40} className="mx-auto mb-3 opacity-30" />
              <p>{posts.length === 0 ? "No posts yet. Be the first to share your experience!" : "No posts match your search."}</p>
            </div>
          ) : (
            filteredPosts.map((post) => (
              <PostCard
                key={`${post.owner_username}-${post.content_index}`}
                post={post}
                identity={identity}
                myProfilePicUrl={myProfilePicUrl}
                onChanged={updatePostInList}
                onDeleted={removePostFromList}
                requireIdentity={requireIdentity}
              />
            ))
          )}
        </div>

        {/* Sidebar - right */}
        <div className="space-y-5">
          {/* Top Travelers — real ranking by post count */}
          {topTravelers.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Trophy size={15} className="text-[#D4AF37]" />
                Top Travelers
              </h3>
              <ul className="space-y-3">
                {topTravelers.map((t, idx) => (
                  <li key={t.username} className="flex items-center gap-3">
                    <span className="w-4 text-xs font-semibold text-gray-500 flex-shrink-0">{idx + 1}</span>
                    <Avatar name={t.username} imageUrl={t.profile_pic_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">@{t.username}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {t.count} post{t.count !== 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Community Guidelines card */}
          <div className="bg-gradient-to-br from-[#D4AF37]/15 to-[#8B7355]/10 border border-[#D4AF37]/30 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-[#D4AF37] mb-3 flex items-center gap-2">
              <Sparkles size={15} />
              Community Guidelines
            </h3>
            <ul className="space-y-2 text-xs text-gray-400">
              {[
                "Share honest, first-hand experiences",
                "Be respectful of local culture & customs",
                "Include helpful tips for fellow travelers",
                "No spam or promotional content",
              ].map((rule) => (
                <li key={rule} className="flex items-start gap-2">
                  <MapPin size={12} className="text-[#D4AF37] mt-0.5 flex-shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}