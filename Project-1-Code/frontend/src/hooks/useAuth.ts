import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setUser, setToken, setLoading, setError } from '../store/slices/authSlice';

export const useAuth = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        dispatch(setLoading(false));
        return;
      }

      try {
        dispatch(setLoading(true));

        // Verify token with backend
        const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Token validation failed');
        }

        const userData = await response.json();

        // Update Redux store
        dispatch(setUser({
          id: userData.id,
          email: userData.email,
          companyName: '', // Backend doesn't have company name yet
          role: userData.role === 'admin' ? 'admin' : 'customer',
          firstName: userData.firstName,
          lastName: userData.lastName
        }));
        dispatch(setToken(token));

      } catch (error) {
        console.error('Auth initialization error:', error);
        // Clear invalid token
        localStorage.removeItem('token');
        dispatch(setError('Session expired. Please log in again.'));
      } finally {
        dispatch(setLoading(false));
      }
    };

    initializeAuth();
  }, [dispatch]);
};
