import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { auth } from './config';

const ALLOWED_EMAILS = [
  'sam.stanley@workmobileforms.com',
  'samstanleywm@gmail.com',
  'benjamin.agheipour@workmobileforms.com',
  'saad.akram@workmobileforms.com'
];

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const login = async (email, password) => {
    setError(null);
    if (!ALLOWED_EMAILS.includes(email)) {
      throw new Error('Unauthorized email address');
    }
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email, password) => {
    setError(null);
    if (!ALLOWED_EMAILS.includes(email)) {
      throw new Error('Unauthorized email address');
    }
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !ALLOWED_EMAILS.includes(user.email)) {
        // If user is not authorized, sign them out
        signOut(auth);
        setCurrentUser(null);
        setError('Unauthorized email address');
      } else {
        setCurrentUser(user);
        setError(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    login,
    signup,
    logout,
    loading,
    error,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
