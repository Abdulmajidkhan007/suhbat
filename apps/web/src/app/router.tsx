import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import FullscreenLoader from '../components/ui/FullscreenLoader';
import LoginPage    from '../pages/LoginPage';
import ChatPage     from '../pages/ChatPage';
import NotFoundPage from '../pages/NotFoundPage';

const AppRouter: React.FC = () => (
  <BrowserRouter>
    <Suspense fallback={<FullscreenLoader />}>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/"         element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/:chatId"  element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="*"         element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default AppRouter;
