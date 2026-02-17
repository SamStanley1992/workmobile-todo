import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRoutes from './AppRoutes.jsx'
import Login from './Login.jsx'
import { AuthProvider, useAuth } from './firebase/AuthContext.jsx'

function App() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-400 to-green-600">
        <div className="text-white text-xl font-semibold">Loading...</div>
      </div>
    );
  }

  return currentUser ? <AppRoutes /> : <Login />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
