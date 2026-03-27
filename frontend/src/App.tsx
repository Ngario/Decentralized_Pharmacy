import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LandingScreen from './screens/client/LandingScreen';
import ProductSelectionScreen from './screens/client/ProductSelectionScreen';
import CartCheckoutScreen from './screens/client/CartCheckoutScreen';
import PharmacistConsultationScreen from './screens/client/PharmacistConsultationScreen';
import RequestsQueueScreen from './screens/pharmacist/RequestsQueueScreen';
import DawaPageLayout from './components/layout/DawaPageLayout';

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <DawaPageLayout
            title="DawaFlow"
            subtitle="OTC-only vending. For severe symptoms, visit a clinician or talk to a pharmacist."
          >
            <LandingScreen />
          </DawaPageLayout>
        }
      />
      <Route
        path="/products"
        element={
          <DawaPageLayout title="DawaFlow" subtitle="OTC-only vending. Choose your category and checkout.">
            <ProductSelectionScreen />
          </DawaPageLayout>
        }
      />
      <Route
        path="/consult"
        element={<DawaPageLayout title="DawaFlow" subtitle="Pharmacist consultation (optional)."> <PharmacistConsultationScreen /> </DawaPageLayout>}
      />
      <Route
        path="/cart"
        element={<DawaPageLayout title="DawaFlow" subtitle="Pay via M-Pesa, then dispensing follows."> <CartCheckoutScreen /> </DawaPageLayout>}
      />
      <Route
        path="/pharmacist/requests"
        element={<DawaPageLayout title="DawaFlow" subtitle="Pharmacist dashboard - approve/reject."> <RequestsQueueScreen /> </DawaPageLayout>}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

