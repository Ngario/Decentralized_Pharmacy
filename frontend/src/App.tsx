import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LandingScreen from './screens/client/LandingScreen';
import ProductSelectionScreen from './screens/client/ProductSelectionScreen';
import CartCheckoutScreen from './screens/client/CartCheckoutScreen';
import PharmacistConsultationScreen from './screens/client/PharmacistConsultationScreen';
import RequestsQueueScreen from './screens/pharmacist/RequestsQueueScreen';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingScreen />} />
      <Route path="/products" element={<ProductSelectionScreen />} />
      <Route path="/consult" element={<PharmacistConsultationScreen />} />
      <Route path="/cart" element={<CartCheckoutScreen />} />
      <Route path="/pharmacist/requests" element={<RequestsQueueScreen />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

