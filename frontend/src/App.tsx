import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { TripsListPage } from "./pages/TripsListPage";
import { NewTripPage } from "./pages/NewTripPage";
import { TripDetailPage } from "./pages/TripDetailPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/trips" replace />} />
          <Route path="/trips" element={<TripsListPage />} />
          <Route path="/trips/new" element={<NewTripPage />} />
          <Route path="/trips/:id" element={<TripDetailPage />} />
          <Route path="/trips/:id/:tab" element={<TripDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
