import { useEffect, useState } from "react";
import http from "../api/http";
import { clearSession, getStoredUser, getToken, setSession } from "../lib/storage";
import { AuthContext } from "./AuthContextValue";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser());
  const [token, setToken] = useState(getToken());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const existingToken = getToken();
      const existingUser = getStoredUser();

      if (!existingToken) {
        setUser(existingUser);
        setIsLoading(false);
        return;
      }

      try {
        const { data } = await http.get("/users/me");
        setUser(data.user);
        setToken(existingToken);
        setSession({ token: existingToken, user: data.user });
      } catch {
        clearSession();
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (email, password) => {
    const { data } = await http.post("/auth/login", { email, password });
    setUser(data.user);
    setToken(data.token);
    setSession({ token: data.token, user: data.user });
    return data.user;
  };

  const register = async (username, email, password) => {
    const { data } = await http.post("/auth/register", { username, email, password });
    setUser(data.user);
    setToken(data.token);
    setSession({ token: data.token, user: data.user });
    return data.user;
  };

  const continueAsGuest = async () => {
    const { data } = await http.post("/auth/guest");
    setUser(data.user);
    setToken(null);
    setSession({ token: null, user: data.user });
    return data.user;
  };

  const logout = () => {
    clearSession();
    setUser(null);
    setToken(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user),
    isLoggedInUser: Boolean(token),
    isLoading,
    login,
    register,
    continueAsGuest,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
