import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000/api';
const SESSION_KEY = 'tech-store-session';

function AuthModal({
  authMode,
  error,
  isBusy,
  onClose,
  onSubmit,
  onSwitchMode,
  statusMessage,
}) {
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    signUpAsAdmin: false,
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = authMode === 'register'
      ? authForm
      : { email: authForm.email, password: authForm.password };
    onSubmit(payload, authMode);
  };

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="auth-copy">
            <h2 id="auth-title">{authMode === 'login' ? 'Sign in' : 'Create account'}</h2>
            <p>Use your account to keep a private cart.</p>
          </div>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>

        {(error || statusMessage) && (
          <div className={error ? 'alert alert-error' : 'alert alert-success'}>
            {error || statusMessage}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {authMode === 'register' && (
            <label>
              Name
              <input
                value={authForm.name}
                onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                required
                minLength="2"
                autoFocus
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={authForm.email}
              onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
              required
              autoFocus={authMode === 'login'}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={authForm.password}
              onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
              required
              minLength="6"
            />
          </label>
          {authMode === 'register' && (
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={authForm.signUpAsAdmin}
                onChange={(event) => setAuthForm({ ...authForm, signUpAsAdmin: event.target.checked })}
              />
              <span>Sign up as admin</span>
            </label>
          )}
          <div className="auth-actions">
            <button className="primary-btn" type="submit" disabled={isBusy}>
              {isBusy ? 'Working...' : authMode === 'login' ? 'Log in' : 'Create account'}
            </button>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => onSwitchMode(authMode === 'login' ? 'register' : 'login')}
            >
              {authMode === 'login' ? 'Need an account?' : 'Already registered?'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [adminCarts, setAdminCarts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  });
  const [authMode, setAuthMode] = useState('login');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const user = session?.user;
  const isAdmin = user?.role === 'admin';

  const apiFetch = useCallback(async (path, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (session?.token) headers.Authorization = `Bearer ${session.token}`;

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  }, [session?.token]);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setStatusMessage('');
  }, []);

  const handleApiError = useCallback((err) => {
    if (err.message.toLowerCase().includes('token') || err.message.toLowerCase().includes('authentication')) {
      logout();
      setError('Your session expired. Please log in again.');
      return;
    }
    setError(err.message);
  }, [logout]);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await apiFetch('/products');
      setProducts(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to connect to the backend. Make sure the Node server is running.');
    }
  }, [apiFetch]);

  const fetchCart = useCallback(async () => {
    try {
      const data = await apiFetch('/cart');
      setCart(Array.isArray(data) ? data : []);
    } catch (err) {
      handleApiError(err);
    }
  }, [apiFetch, handleApiError]);

  const fetchAdminCarts = useCallback(async () => {
    try {
      const data = await apiFetch('/admin/users/carts');
      setAdminCarts(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      handleApiError(err);
    }
  }, [apiFetch, handleApiError]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (!session?.token) {
      setCart([]);
      setAdminCarts([]);
      return;
    }

    fetchCart();
    if (session.user.role === 'admin') fetchAdminCarts();
  }, [fetchAdminCarts, fetchCart, session]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => product.name.toLowerCase().includes(query));
  }, [products, searchTerm]);

  const cartTotal = useMemo(() => (
    cart.reduce((sum, item) => sum + ((item.productId?.price || 0) * item.quantity), 0)
  ), [cart]);

  const handleAuthSubmit = async (payload, mode) => {
    setIsBusy(true);
    setError('');
    setStatusMessage('');

    try {
      const data = await apiFetch(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const nextSession = { user: data.user, token: data.token };
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setShowAuthModal(false);
      setStatusMessage(mode === 'register' ? 'Account created.' : 'Welcome back.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const refreshUserData = async () => {
    await fetchCart();
    if (isAdmin) await fetchAdminCarts();
  };

  const addToCart = async (productId) => {
    if (!user) {
      setAuthMode('login');
      setShowAuthModal(true);
      setStatusMessage('');
      setError('');
      return;
    }

    try {
      await apiFetch('/cart', {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
      await refreshUserData();
      setStatusMessage('Cart updated.');
    } catch (err) {
      handleApiError(err);
    }
  };

  const updateQuantity = async (id, newQuantity) => {
    try {
      await apiFetch(`/cart/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity: newQuantity }),
      });
      await refreshUserData();
    } catch (err) {
      handleApiError(err);
    }
  };

  const removeFromCart = async (id) => {
    try {
      await apiFetch(`/cart/${id}`, { method: 'DELETE' });
      await refreshUserData();
    } catch (err) {
      handleApiError(err);
    }
  };

  const switchAuthMode = (mode) => {
    setAuthMode(mode);
    setError('');
    setStatusMessage('');
  };

  const openAuthModal = (mode) => {
    setAuthMode(mode);
    setShowAuthModal(true);
    setError('');
    setStatusMessage('');
  };

  const closeAuthModal = () => {
    setShowAuthModal(false);
    setError('');
    setStatusMessage('');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <p className="eyebrow">E-commerce SPA</p>
          <h1>Tech Gadget Store</h1>
        </div>
        {user ? (
          <div className="user-chip">
            <span>{user.name}</span>
            <strong>{user.role}</strong>
            <button onClick={logout}>Log out</button>
          </div>
        ) : (
          <div className="header-actions">
            <button className="ghost-btn" type="button" onClick={() => openAuthModal('login')}>
              Log in
            </button>
            <button className="primary-btn" type="button" onClick={() => openAuthModal('register')}>
              Sign up
            </button>
          </div>
        )}
      </header>

      {(error || statusMessage) && !showAuthModal && (
        <div className={error ? 'alert alert-error' : 'alert alert-success'}>
          {error || statusMessage}
        </div>
      )}

      {showAuthModal && !user && (
        <AuthModal
          authMode={authMode}
          error={error}
          isBusy={isBusy}
          onClose={closeAuthModal}
          onSubmit={handleAuthSubmit}
          onSwitchMode={switchAuthMode}
          statusMessage={statusMessage}
        />
      )}

      {isAdmin && (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Admin Dashboard</p>
              <h2>User Carts</h2>
            </div>
            <button className="ghost-btn" type="button" onClick={fetchAdminCarts}>
              Refresh
            </button>
          </div>

          {adminCarts.length === 0 ? (
            <p className="empty-state">No user carts found.</p>
          ) : (
            <div className="admin-grid">
              {adminCarts.map((entry) => (
                <article key={entry.user.id} className="admin-card">
                  <div className="admin-user">
                    <div>
                      <h3>{entry.user.name}</h3>
                      <p>{entry.user.email}</p>
                    </div>
                    <strong>${entry.total.toFixed(2)}</strong>
                  </div>
                  {entry.items.length === 0 ? (
                    <p className="empty-state compact">No cart items.</p>
                  ) : (
                    <ul className="admin-cart-list">
                      {entry.items.map((item) => (
                        <li key={item._id}>
                          <span>{item.productId?.name || 'Unknown Item'}</span>
                          <strong>x{item.quantity}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <main className="main-layout">
        <section className="product-section">
          <div className="section-heading">
            <h2>Products</h2>
            <label className="search-control">
              <span>Search</span>
              <input
                type="search"
                placeholder="Keyboard, monitor, mouse..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
          </div>

          <div className="product-grid">
            {filteredProducts.map((product) => (
              <article key={product._id} className="product-card">
                <img src={product.image} alt={product.name} className="product-image" />
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p className="price">${product.price?.toFixed(2)}</p>
                  <button onClick={() => addToCart(product._id)} className="primary-btn">
                    Add to cart
                  </button>
                </div>
              </article>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <p className="empty-state">No products match your search.</p>
          )}
        </section>

        <aside className="cart-section">
          <h2>Your Cart</h2>
          {!user ? (
            <p className="empty-state">Log in to start shopping.</p>
          ) : cart.length === 0 ? (
            <p className="empty-state">Your cart is empty.</p>
          ) : (
            <>
              <div className="cart-list">
                {cart.map((item) => (
                  <div key={item._id} className="cart-item">
                    <div className="item-details">
                      <p className="item-name">{item.productId?.name || 'Unknown Item'}</p>
                      <p className="item-price">${item.productId?.price?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="item-controls">
                      <button onClick={() => updateQuantity(item._id, item.quantity - 1)}>-</button>
                      <span className="quantity">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item._id, item.quantity + 1)}>+</button>
                      <button onClick={() => removeFromCart(item._id)} className="remove-btn">Remove</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cart-summary">
                <h3>Total</h3>
                <strong>${cartTotal.toFixed(2)}</strong>
              </div>

              <button className="checkout-btn" onClick={() => setShowPopup(true)}>
                Checkout
              </button>
            </>
          )}
        </aside>
      </main>

      {showPopup && (
        <div className="popup-overlay">
          <div className="popup-content">
            <h2>Proceed to Checkout</h2>
            <p>This feature is coming soon.</p>
            <button onClick={() => setShowPopup(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
