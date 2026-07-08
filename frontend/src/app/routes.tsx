import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Hotels } from "./pages/Hotels";
import { Flights } from "./pages/Flights";
import { Restaurants } from "./pages/Restaurants";
import { AncientSites } from "./pages/AncientSites";
import { Museums } from "./pages/Museums";
import { Monuments } from "./pages/Monuments";
import { HistoricalPeriods } from "./pages/HistoricalPeriods";
import { Beaches } from "./pages/Beaches";
import { Muslim } from "./pages/Muslim";
import { Community } from "./pages/Community";
import { Account } from "./pages/Account";
import { Tickets } from "./pages/Tickets";
import { TripPlanner } from "./pages/TripPlanner";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "trip-planner", Component: TripPlanner },
      { path: "hotels", Component: Hotels },
      { path: "flights", Component: Flights },
      { path: "restaurants", Component: Restaurants },
      { path: "ancient-sites", Component: AncientSites },
      { path: "museums", Component: Museums },
      { path: "monuments", Component: Monuments },
      { path: "historical-periods", Component: HistoricalPeriods },
      { path: "beaches", Component: Beaches },
      { path: "muslim", Component: Muslim },
      { path: "community", Component: Community },
      { path: "account", Component: Account },
      { path: "tickets", Component: Tickets },
      { path: "*", Component: NotFound },
    ],
  },
]);