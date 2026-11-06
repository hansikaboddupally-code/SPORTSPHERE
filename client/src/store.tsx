import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import axios from "axios";
import api, { errorMessage, type CartItem, type Product, type SessionUser } from "./api";

interface StoreValue {
  user: SessionUser | null;
  cart: CartItem[];
  wishlist: Product[];
  coupon: { code: string; type: "percent" | "fixed"; value: number; minimumSpend: number } | null;
  message: string;
  dismissMessage: () => void;
  refreshCart: () => Promise<void>;
  addToCart: (product: Product, quantity?: number, size?: string, color?: string) => Promise<void>;
  addKit: (sport: string, items: Array<{ productId: string; quantity: number; size?: string; color?: string }>) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  toggleWishlist: (product: Product) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: SessionUser | null) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [coupon, setCoupon] = useState<StoreValue["coupon"]>(null);
  const [message, setMessage] = useState("");

  const refreshCart = useCallback(async () => {
    try {
      const { data } = await api.get<{ items: CartItem[]; coupon: StoreValue["coupon"] }>("/cart");
      setCart(data.items);
      setCoupon(data.coupon);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) setCart([]);
      else setMessage(errorMessage(error));
    }
  }, []);

  const refreshWishlist = useCallback(async () => {
    try {
      const { data } = await api.get<{ products: Product[] }>("/cart/wishlist");
      setWishlist(data.products);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    api.get<{ user: SessionUser }>("/auth/me")
      .then(({ data }) => {
        setUser(data.user);
      })
      .catch((error: unknown) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) setUser(null);
        else setMessage(errorMessage(error));
      });
  }, []);

  useEffect(() => {
    if (user) {
      void Promise.all([refreshCart(), refreshWishlist()]);
    } else {
      setCart([]);
      setWishlist([]);
      setCoupon(null);
    }
  }, [user, refreshCart, refreshWishlist]);

  const addToCart = useCallback(async (product: Product, quantity = 1, size?: string, color?: string) => {
    if (!user) {
      setMessage("Sign in to save items to your shopping bag.");
      return;
    }
    try {
      const { data } = await api.post<{ items: CartItem[] }>("/cart/items", { productId: product._id, quantity, size, color });
      setCart(data.items);
      setMessage(`${product.name} added to your bag.`);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, [user]);

  const applyCoupon = useCallback(async (code: string) => {
    try {
      const { data } = await api.post<{ coupon: NonNullable<StoreValue["coupon"]>; message: string }>("/cart/coupon", { code });
      setCoupon(data.coupon);
      setMessage(data.message);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, []);

  const removeCoupon = useCallback(async () => {
    try {
      await api.delete("/cart/coupon");
      setCoupon(null);
      setMessage("Coupon removed.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, []);

  const addKit = useCallback(async (sport: string, items: Array<{ productId: string; quantity: number; size?: string; color?: string }>) => {
    if (!user) {
      setMessage("Sign in to add a custom kit to your bag.");
      return;
    }
    try {
      const { data } = await api.post<{ items: CartItem[] }>("/cart/kits", { sport, items });
      setCart(data.items);
      setMessage("Your kit is in the bag — 10% off kits with three or more pieces.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, [user]);

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    try {
      const { data } = await api.patch<{ items: CartItem[] }>(`/cart/items/${itemId}`, { quantity });
      setCart(data.items);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, []);

  const removeFromCart = useCallback(async (itemId: string) => {
    try {
      const { data } = await api.delete<{ items: CartItem[] }>(`/cart/items/${itemId}`);
      setCart(data.items);
      setMessage("Item removed from your bag.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, []);

  const toggleWishlist = useCallback(async (product: Product) => {
    if (!user) {
      setMessage("Sign in to save products to your wishlist.");
      return;
    }
    try {
      if (wishlist.some((item) => item._id === product._id)) {
        const { data } = await api.delete<{ products: Product[] }>(`/cart/wishlist/${product._id}`);
        setWishlist(data.products);
        setMessage("Removed from your wishlist.");
      } else {
        const { data } = await api.post<{ products: Product[] }>(`/cart/wishlist/${product._id}`);
        setWishlist(data.products);
        setMessage("Saved to your wishlist.");
      }
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, [user, wishlist]);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout");
      setUser(null);
      setCart([]);
      setWishlist([]);
      setCoupon(null);
      setMessage("You have been signed out.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, []);

  const value = useMemo(() => ({
    user, cart, wishlist, coupon, message, dismissMessage: () => setMessage(""),
    refreshCart, addToCart, addKit, applyCoupon, removeCoupon, updateQuantity, removeFromCart, toggleWishlist, signOut, setUser,
  }), [user, cart, wishlist, coupon, message, refreshCart, addToCart, addKit, applyCoupon, removeCoupon, updateQuantity, removeFromCart, toggleWishlist, signOut]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider.");
  return value;
}
