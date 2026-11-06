import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Check, CircleUserRound, Heart,
  Menu, Minus, Plus, Search, ShoppingBag, SlidersHorizontal, Sparkles, Star, Trash2, X,
} from "lucide-react";
import api, { errorMessage, type Order, type Product, type ProductVariant, type SessionUser } from "./api";
import { useStore } from "./store";

const categories = ["Sports Clothing", "Sports Footwear", "Sports Equipment", "Gym & Fitness", "Accessories"];
const sports = ["Cricket", "Football", "Basketball", "Badminton", "Tennis", "Gym & Fitness", "Running"];
const money = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;
function kitSavings(items: Array<{ product: Product; quantity: number; kitId?: string }>): number {
  const groups = new Map<string, { count: number; total: number }>();
  for (const item of items) {
    if (!item.kitId) continue;
    const group = groups.get(item.kitId) ?? { count: 0, total: 0 };
    group.count += item.quantity;
    group.total += item.product.price * item.quantity;
    groups.set(item.kitId, group);
  }
    return [...groups.values()].reduce((savings, group) => savings + (group.count >= 3 ? group.total * 0.1 : 0), 0);
  }

  function couponSavings(coupon: { type: "percent" | "fixed"; value: number; minimumSpend: number } | null, subtotal: number): number {
    if (!coupon || subtotal < coupon.minimumSpend) return 0;
    return Math.min(subtotal, coupon.type === "percent" ? subtotal * coupon.value / 100 : coupon.value);
  }
const discount = (product: Product) => product.compareAtPrice > product.price
  ? Math.round((1 - product.price / product.compareAtPrice) * 100)
  : 0;

function Toast() {
  const { message, dismissMessage } = useStore();
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(dismissMessage, 3500);
    return () => window.clearTimeout(timer);
  }, [message, dismissMessage]);
  return message ? <div className="toast" role="status">{message}<button aria-label="Dismiss" onClick={dismissMessage}><X size={15} /></button></div> : null;
}

function Header() {
  const { cart, user } = useStore();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    navigate(`/shop?q=${encodeURIComponent(query.trim())}`);
    setMenuOpen(false);
  };
  return <>
    <div className="announcement">FREE SHIPPING ON ORDERS OVER ₹1,500 <span>·</span> BUILT FOR EVERY MOVE</div>
    <header className="site-header">
      <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      <Link to="/" className="brand-lockup" aria-label="SportSphere home">
        <span className="brand-mark">S<span>.</span></span><span className="brand-name">SPORT<span>SPHERE</span></span>
      </Link>
      <nav className={`main-nav ${menuOpen ? "is-open" : ""}`}>
        <Link to="/shop" onClick={() => setMenuOpen(false)}>Shop all</Link>
        <Link to="/shop?category=Sports%20Clothing" onClick={() => setMenuOpen(false)}>Clothing</Link>
        <Link to="/shop?category=Sports%20Footwear" onClick={() => setMenuOpen(false)}>Footwear</Link>
        <Link to="/kit-builder" onClick={() => setMenuOpen(false)}>Kit builder <span className="nav-new">NEW</span></Link>
      </nav>
      <form className="header-search" onSubmit={submitSearch}>
        <Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search gear..." aria-label="Search products" />
      </form>
      <div className="header-actions">
        {user ? <Link className="account-name" to="/profile" title="Your account"><CircleUserRound size={19} /><span>{user.name.split(" ")[0]}</span></Link> : <Link className="icon-button" to="/login" aria-label="Sign in"><CircleUserRound /></Link>}
        <Link className="icon-button" to="/wishlist" aria-label="Wishlist"><Heart /></Link>
        <Link className="icon-button bag-action" to="/cart" aria-label={`Shopping bag, ${cart.reduce((sum, item) => sum + item.quantity, 0)} items`}>
          <ShoppingBag /><span className="bag-count">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
        </Link>
      </div>
    </header>
  </>;
}

function Footer() {
  return <footer className="site-footer">
    <div className="footer-main">
      <div className="footer-brand"><Link to="/" className="brand-lockup"><span className="brand-mark">S<span>.</span></span><span className="brand-name">SPORT<span>SPHERE</span></span></Link><p>Good gear changes everything.<br />Find your next move here.</p></div>
      <div><h4>Explore</h4>{categories.slice(0, 4).map((category) => <Link key={category} to={`/shop?category=${encodeURIComponent(category)}`}>{category}</Link>)}</div>
      <div><h4>Your account</h4><Link to="/login">Sign in</Link><Link to="/orders">Track an order</Link><Link to="/wishlist">Wishlist</Link><Link to="/compare">Compare gear</Link></div>
      <div className="newsletter"><h4>GOOD THINGS IN YOUR INBOX</h4><p>New drops, training tips and the occasional surprise.</p><NewsletterForm /></div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} SPORTSPHERE. EVERY SPORT. EVERY GEAR.</span><span>MADE FOR THE WAY YOU MOVE.</span></div>
  </footer>;
}

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const { data } = await api.post<{ message: string }>("/newsletter", { email });
      setStatus(data.message);
      setEmail("");
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };
  return <form className="newsletter-form" onSubmit={submit}><input type="email" required placeholder="Your email address" value={email} onChange={(event) => setEmail(event.target.value)} /><button aria-label="Subscribe"><ArrowRight size={18} /></button>{status && <small>{status}</small>}</form>;
}

function ProductImage({ product, className = "" }: { product: Product; className?: string }) {
  return <div className={`product-image ${className}`}>
    <img src={product.images[0]} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
  </div>;
}

function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { wishlist, toggleWishlist, addToCart } = useStore();
  const navigate = useNavigate();
  const [compared, setCompared] = useState(() => {
    try { return (JSON.parse(localStorage.getItem("sportsphere-compare") ?? "[]") as string[]).includes(product._id); }
    catch { return false; }
  });
  const isSaved = wishlist.some((item) => item._id === product._id);
  const toggleCompare = () => {
    let ids: string[] = [];
    try { ids = JSON.parse(localStorage.getItem("sportsphere-compare") ?? "[]") as string[]; } catch { ids = []; }
    if (ids.includes(product._id)) ids = ids.filter((id) => id !== product._id);
    else if (ids.length >= 4) return;
    else ids.push(product._id);
    localStorage.setItem("sportsphere-compare", JSON.stringify(ids));
    setCompared(ids.includes(product._id));
  };
  return <article className="product-card" style={{ animationDelay: `${Math.min(index, 6) * 55}ms` }}>
    <div className="product-visual">
      <Link to={`/product/${product.slug}`}><ProductImage product={product} /></Link>
      {discount(product) > 0 && <span className="discount-tag">-{discount(product)}%</span>}
      {product.featured && <span className="feature-tag">TRENDING</span>}
      <button className={`wish-button ${isSaved ? "saved" : ""}`} onClick={() => void toggleWishlist(product)} aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}><Heart size={17} fill={isSaved ? "currentColor" : "none"} /></button>
      <button className="quick-add" onClick={() => product.sizes.length || product.colors.length ? navigate(`/product/${product.slug}`) : void addToCart(product)}>QUICK ADD <Plus size={14} /></button>
    </div>
    <div className="product-info">
      <div className="product-kicker"><span>{product.brand}</span><button className={`compare-toggle ${compared ? "selected" : ""}`} onClick={toggleCompare}>{compared ? <Check size={12} /> : <Plus size={12} />} Compare</button></div>
      <Link to={`/product/${product.slug}`} className="product-title">{product.name}</Link>
      <div className="product-rating"><Star size={13} fill="currentColor" /><b>{product.rating.toFixed(1)}</b><span>({product.reviewCount})</span></div>
      <div className="price-line"><b>{money(product.price)}</b>{product.compareAtPrice > product.price && <del>{money(product.compareAtPrice)}</del>}</div>
    </div>
  </article>;
}

function ProductGrid({ products, loading, message, empty = "Nothing here just yet." }: { products: Product[]; loading: boolean; message?: string; empty?: string }) {
  if (loading) return <div className="loading-grid">{Array.from({ length: 4 }, (_, i) => <div className="skeleton" key={i} />)}</div>;
  if (message) return <div className="notice-box">{message}</div>;
  if (!products.length) return <div className="empty-state"><span>✳</span><h3>{empty}</h3><Link className="text-link" to="/shop">Explore the shop <ArrowRight size={15} /></Link></div>;
  return <div className="product-grid">{products.map((product, index) => <ProductCard key={product._id} product={product} index={index} />)}</div>;
}

function useProducts(endpoint: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get<{ products: Product[] }>(`/products${endpoint}`).then(({ data }) => {
      if (active) setProducts(data.products);
    }).catch((failure: unknown) => {
      if (active) setError(errorMessage(failure));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint]);
  return { products, loading, error };
}

function HomePage() {
  const { products, loading, error } = useProducts("?sort=popular&limit=8");
  const [discovery, setDiscovery] = useState<{ products: Product[]; recentlyViewed: Product[] }>({ products: [], recentlyViewed: [] });
  const [discoveryError, setDiscoveryError] = useState("");
  useEffect(() => {
    let viewed: string[] = [];
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("sportsphere-recently-viewed") ?? "[]");
      if (Array.isArray(stored)) viewed = stored.filter((id): id is string => typeof id === "string").slice(0, 8);
    } catch { localStorage.removeItem("sportsphere-recently-viewed"); }
    api.get<typeof discovery>(`/products/recommendations?viewed=${encodeURIComponent(viewed.join(","))}`)
      .then(({ data }) => setDiscovery(data))
      .catch((failure: unknown) => setDiscoveryError(errorMessage(failure)));
  }, []);
  return <>
    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> THE NEXT REP. THE NEXT RUN. THE NEXT WIN.</div>
          <h1>Find your<br />next <em>gear.</em></h1>
          <p>Purpose-built essentials for every version of you. Whatever your game, show up ready.</p>
          <div className="hero-actions"><Link className="button button-dark" to="/shop">Shop the collection <ArrowUpRight size={17} /></Link><Link className="button button-plain" to="/kit-builder">Build a sports kit <ArrowRight size={16} /></Link></div>
          <div className="hero-proof"><div className="avatar-stack"><span>R</span><span>A</span><span>K</span></div><div><b>4.9/5</b><span>LOVED BY 12K+ MOVERS</span></div><span className="proof-divider" /><div><b>40+</b><span>CURATED PICKS</span></div></div>
        </div>
        <div className="hero-art">
          <img src="https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1400&q=88" alt="Athlete in motion on a running track" />
          <div className="hero-sticker"><span>GEAR UP.</span><span>GO ALL IN.</span><ArrowDownRight size={21} /></div>
          <div className="hero-art-label"><span>01 / 04</span><span>BUILT FOR MOVEMENT</span></div>
        </div>
        <div className="hero-index">SS — 2025 / 26</div>
      </section>

      <section className="section category-section">
        <div className="section-heading"><div><span className="eyebrow">PICK YOUR PLAY</span><h2>What are we<br className="mobile-only" /> moving in?</h2></div><Link className="text-link" to="/shop">View all categories <ArrowRight size={15} /></Link></div>
        <div className="category-grid">
          {[
            { name: "Sports Clothing", label: "01 / THE LAYERS", icon: "01", color: "coral" },
            { name: "Sports Footwear", label: "02 / THE FOUNDATION", icon: "02", color: "blue" },
            { name: "Sports Equipment", label: "03 / THE EDGE", icon: "03", color: "lime" },
            { name: "Gym & Fitness", label: "04 / THE WORK", icon: "04", color: "purple" },
          ].map((item) => <Link to={`/shop?category=${encodeURIComponent(item.name)}`} className={`category-tile ${item.color}`} key={item.name}><span className="tile-label">{item.label}</span><span className="tile-number">{item.icon}</span><h3>{item.name}</h3><span className="tile-arrow"><ArrowUpRight size={19} /></span></Link>)}
        </div>
      </section>

      <section className="section trending-section"><div className="section-heading"><div><span className="eyebrow">THE CROWD FAVOURITES</span><h2>Good gear. Great energy.</h2></div><Link className="text-link" to="/shop?sort=popular">Shop best sellers <ArrowRight size={15} /></Link></div><ProductGrid products={products} loading={loading} message={error} /></section>
      {discovery.recentlyViewed.length > 0 && <section className="section"><div className="section-heading"><div><span className="eyebrow">BACK IN YOUR ORBIT</span><h2>Recently viewed.</h2></div></div><ProductGrid products={discovery.recentlyViewed} loading={false} /></section>}
      {discovery.products.length > 0 && <section className="section"><div className="section-heading"><div><span className="eyebrow">PICKED FOR YOUR GAME</span><h2>More to explore.</h2></div></div><ProductGrid products={discovery.products} loading={false} /></section>}
      {discoveryError && <div className="page-shell"><div className="notice-box">{discoveryError}</div></div>}

      <section className="sports-promo"><div><span className="eyebrow light-eyebrow">YOUR GAME, YOUR RULES</span><h2>One kit.<br /><em>All you.</em></h2><p>Build a ready-to-play kit around your sport, your style and your next big moment.</p><Link className="button button-lime" to="/kit-builder">Build your sports kit <ArrowUpRight size={17} /></Link></div><div className="promo-orbit orbit-one" /><div className="promo-orbit orbit-two" /><span className="promo-sticker">PICK.<br />PACK.<br />PLAY.</span><div className="promo-number">SS / KIT BUILDER</div></section>

      <section className="section sport-section"><div className="section-heading"><div><span className="eyebrow">MADE FOR YOUR MOMENT</span><h2>What’s your sport?</h2></div><span className="muted-copy">Find the gear that gets you there.</span></div><div className="sport-chips">{sports.map((sport, index) => <Link to={`/shop?sport=${encodeURIComponent(sport)}`} key={sport}><span>0{index + 1}</span>{sport}<ArrowUpRight size={16} /></Link>)}</div></section>

      <section className="quote-band"><Sparkles size={20} /><blockquote>“The right gear doesn’t make the athlete. <em>It lets them show up as one.</em>”</blockquote><span>THE SPORTSPHERE WAY — 2025</span></section>
    </main>
  </>;
}

function ShopPage() {
  const [params, setParams] = useSearchParams();
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [sport, setSport] = useState(params.get("sport") ?? "");
  const [brand, setBrand] = useState(params.get("brand") ?? "");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [minRating, setMinRating] = useState("");
  const [inStock, setInStock] = useState("");
  const [sort, setSort] = useState(params.get("sort") ?? "newest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [mobileFilters, setMobileFilters] = useState(false);
  useEffect(() => {
    api.get<{ categories: Array<{ name: string }> }>("/products/categories")
      .then(({ data }) => { if (data.categories.length) setCategoryOptions(data.categories.map((item) => item.name)); })
      .catch(() => setCategoryOptions(categories));
  }, []);
  const endpoint = useMemo(() => {
    const query = new URLSearchParams();
    const search = params.get("q");
    if (search) query.set("q", search);
    if (category) query.set("category", category);
    if (sport) query.set("sport", sport);
    if (brand) query.set("brand", brand);
    if (size) query.set("size", size);
    if (color) query.set("color", color);
    if (minRating) query.set("minRating", minRating);
    if (inStock) query.set("inStock", inStock);
    if (sort) query.set("sort", sort);
    if (minPrice) query.set("minPrice", minPrice);
    if (maxPrice) query.set("maxPrice", maxPrice);
    query.set("limit", "48");
    return `?${query.toString()}`;
  }, [params, category, sport, brand, size, color, minRating, inStock, sort, minPrice, maxPrice]);
  const { products, loading, error } = useProducts(endpoint);
  const search = params.get("q");
  const clearFilters = () => {
    setCategory(""); setSport(""); setBrand(""); setSize(""); setColor(""); setMinRating(""); setInStock(""); setSort("newest"); setMinPrice(""); setMaxPrice("");
    setParams(search ? { q: search } : {});
  };
  return <main className="page-shell">
    <div className="page-intro"><div className="eyebrow">THE SPORTSPHERE SHOP / 01</div><h1>{search ? <>Results for <em>“{search}”</em></> : <>Gear up for<br /><em>what moves you.</em></>}</h1><p>Performance-first picks for your game, training and everyday.</p></div>
    <div className="shop-toolbar"><span>{loading ? "Finding your gear..." : `${products.length} curated pieces`}</span><div className="shop-toolbar-actions"><button className="filter-mobile-button" onClick={() => setMobileFilters(!mobileFilters)}><SlidersHorizontal size={15} /> Filters</button><label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="popular">Most popular</option><option value="rating">Best rated</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="discount">Biggest discount</option></select></label></div></div>
    <div className={`shop-layout ${mobileFilters ? "filters-open" : ""}`}>
      <aside className="filter-panel"><div className="filter-title">FILTERS <button onClick={clearFilters}>Clear all</button></div>
        <label className="filter-group">Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categoryOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="filter-group">Sport<select value={sport} onChange={(event) => setSport(event.target.value)}><option value="">All sports</option>{sports.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="filter-group">Brand<select value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">All brands</option>{["NORTHSTAR", "PULSE", "STRIKER", "COURT CO.", "RALLY"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="filter-group">Size<select value={size} onChange={(event) => setSize(event.target.value)}><option value="">Any size</option>{["XS", "S", "M", "L", "XL", "6", "7", "8", "9", "10", "11", "One size"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="filter-group">Colour<select value={color} onChange={(event) => setColor(event.target.value)}><option value="">Any colour</option>{["Black", "White", "Blue", "Navy", "Red", "Orange", "Green", "Grey", "Coral"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="filter-group">Customer rating<select value={minRating} onChange={(event) => setMinRating(event.target.value)}><option value="">Any rating</option><option value="4">4★ and above</option><option value="3">3★ and above</option><option value="2">2★ and above</option></select></label>
        <label className="filter-group">Availability<select value={inStock} onChange={(event) => setInStock(event.target.value)}><option value="">All products</option><option value="true">In stock</option><option value="false">Out of stock</option></select></label>
        <div className="filter-group"><span>Price range</span><div className="price-inputs"><input inputMode="numeric" placeholder="Min ₹" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /><input inputMode="numeric" placeholder="Max ₹" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></div></div>
        <div className="filter-note"><Sparkles size={15} /> Every order over ₹1,500 ships free.</div>
      </aside>
      <div className="shop-results"><ProductGrid products={products} loading={loading} message={error} empty="No products match those filters. Try another combination." /></div>
    </div>
  </main>;
}

function ProductPage() {
  const { slug = "" } = useParams();
  const { addToCart, toggleWishlist, wishlist } = useStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [reviewMessage, setReviewMessage] = useState("");
  useEffect(() => {
    api.get<{ product: Product; related: Product[]; reviews: Array<{ _id: string; rating: number; title?: string; body: string; user?: { name: string } }>; variants: ProductVariant[] }>(`/products/${slug}`)
      .then(({ data }) => {
        setProduct(data.product);
        setRelated(data.related);
        setVariants(data.variants);
        setSize("");
        setColor("");
        setQuantity(1);
        try {
          const stored: unknown = JSON.parse(localStorage.getItem("sportsphere-recently-viewed") ?? "[]");
          const prior = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
          localStorage.setItem("sportsphere-recently-viewed", JSON.stringify([data.product._id, ...prior.filter((id) => id !== data.product._id)].slice(0, 8)));
        } catch { localStorage.setItem("sportsphere-recently-viewed", JSON.stringify([data.product._id])); }
      })
      .catch((failure: unknown) => setError(errorMessage(failure)));
  }, [slug]);
  if (error) return <main className="page-shell"><div className="notice-box">{error}<Link to="/shop"> Back to shop</Link></div></main>;
  if (!product) return <main className="page-shell"><div className="loading-grid"><div className="skeleton" /><div className="skeleton" /></div></main>;
  const selectedColor = color || product.colors[0] || "";
  const selectedVariant = variants.find((variant) => variant.size === size && variant.color === selectedColor);
  const availableStock = variants.length ? selectedVariant?.stock ?? 0 : product.stock;
  const saved = wishlist.some((item) => item._id === product._id);
  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const { data } = await api.post(`/products/${product._id}/reviews`, { rating: Number(form.get("rating")), title: form.get("title"), body: form.get("body") });
      setReviewMessage(data.message);
      formElement.reset();
    } catch (failure) { setReviewMessage(errorMessage(failure)); }
  };
  return <main className="page-shell product-page">
    <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to="/shop">{product.category}</Link><span>/</span><span>{product.name}</span></div>
    <div className="product-detail-layout"><div className="detail-gallery"><div className="detail-main-image"><img src={product.images[activeImage]} alt={product.name} /></div>{product.images.length > 1 && <div className="detail-thumbnails">{product.images.map((image, index) => <button key={image} className={index === activeImage ? "active" : ""} onClick={() => setActiveImage(index)}><img src={image} alt={`${product.name} view ${index + 1}`} /></button>)}</div>}</div>
      <div className="detail-copy"><span className="eyebrow">{product.brand} / {product.sport}</span><h1>{product.name}</h1><div className="detail-rating"><span><Star size={15} fill="currentColor" /> {product.rating.toFixed(1)}</span> {product.reviewCount} reviews <a href="#reviews">Read reviews</a></div>
        <div className="detail-pricing"><b>{money(product.price)}</b>{product.compareAtPrice > product.price && <><del>{money(product.compareAtPrice)}</del><span>{discount(product)}% OFF</span></>}</div>
        <p className="detail-description">{product.description}</p><div className={`stock-note ${availableStock <= 5 ? "low-stock" : ""}`}><span />{availableStock ? availableStock <= 5 ? `Only ${availableStock} left — make it yours.` : "In stock and ready to move." : "Currently out of stock for this selection"}</div>
        {product.sizes.length > 0 && <div className="option-group"><div><b>Choose size</b><span>Size guide</span></div><div className="option-buttons">{product.sizes.map((item) => { const stock = variants.length ? variants.filter((variant) => variant.size === item).reduce((total, variant) => total + variant.stock, 0) : product.stock; return <button className={size === item ? "active" : ""} key={item} disabled={!stock} onClick={() => { setSize(item); setQuantity(1); }}>{item}</button>; })}</div></div>}
        {product.colors.length > 0 && <div className="option-group"><div><b>Colour</b><span>{selectedColor}</span></div><div className="color-options">{product.colors.map((item) => { const stock = variants.length ? variants.find((variant) => variant.size === size && variant.color === item)?.stock ?? 0 : product.stock; return <button key={item} disabled={!stock} className={`${selectedColor === item ? "active" : ""} color-chip color-${item.toLowerCase().replaceAll(" ", "-")}`} title={item} aria-label={`${item}${stock ? "" : " (out of stock)"}`} onClick={() => { setColor(item); setQuantity(1); }} />; })}</div></div>}
        <div className="detail-buy-row"><div className="quantity-control"><button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={14} /></button><span>{quantity}</span><button aria-label="Increase quantity" disabled={quantity >= availableStock} onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}><Plus size={14} /></button></div><button className="button button-dark buy-button" disabled={!availableStock || (product.sizes.length > 0 && !size)} onClick={() => void addToCart(product, quantity, size, selectedColor)}>{!availableStock ? "Sold out" : product.sizes.length > 0 && !size ? "Select your size" : "Add to bag"} <ShoppingBag size={17} /></button><button className={`icon-button wishlist-detail ${saved ? "saved" : ""}`} onClick={() => void toggleWishlist(product)} aria-label="Toggle wishlist"><Heart fill={saved ? "currentColor" : "none"} /></button></div>
        <div className="delivery-card"><span>↗</span><div><b>FREE DELIVERY ON ₹1,500+</b><p>Easy returns within 7 days. No questions asked.</p></div></div>
        <div className="specs"><h3>THE DETAILS</h3>{Object.entries(product.specifications ?? {}).map(([key, value]) => <div key={key}><span>{key}</span><b>{value}</b></div>)}</div>
      </div>
    </div>
    <section className="section reviews-section" id="reviews"><div className="section-heading"><div><span className="eyebrow">REAL PEOPLE. REAL MOVES.</span><h2>Reviews & ratings</h2></div><span className="detail-rating"><Star size={15} fill="currentColor" /> {product.rating.toFixed(1)} / 5</span></div><ReviewList productId={product._id} /><form className="review-form" onSubmit={submitReview}><h3>Leave a review</h3><div className="form-grid"><label>Rating<select name="rating" defaultValue="5"><option value="5">5 — Loved it</option><option value="4">4 — Great</option><option value="3">3 — Good</option><option value="2">2 — Fair</option><option value="1">1 — Not for me</option></select></label><label>Title<input name="title" maxLength={100} placeholder="Summarize your experience" /></label></div><label>Your review<textarea name="body" minLength={10} maxLength={1500} required placeholder="What did you think of it?" /></label><button className="button button-dark">Submit review <ArrowRight size={16} /></button>{reviewMessage && <span className="inline-message">{reviewMessage}</span>}</form></section>
    <section className="section"><div className="section-heading"><div><span className="eyebrow">MORE FROM YOUR GAME</span><h2>Keep the momentum.</h2></div></div><ProductGrid products={related} loading={false} /></section>
  </main>;
}

function ReviewList({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<Array<{ _id: string; rating: number; title?: string; body: string; user?: { name: string } }>>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api.get<{ reviews: typeof reviews }>(`/products/${productId}`).then(({ data }) => setReviews(data.reviews)).catch((failure: unknown) => setError(errorMessage(failure)));
  }, [productId]);
  if (error) return <div className="notice-box">{error}</div>;
  if (!reviews.length) return <div className="review-empty">No reviews yet. Be the first to share what you think.</div>;
  return <div className="review-grid">{reviews.map((review) => <article key={review._id} className="review-card"><div className="review-stars">{Array.from({ length: review.rating }, (_, index) => <Star size={13} fill="currentColor" key={index} />)}</div><h4>{review.title || "A customer review"}</h4><p>{review.body}</p><span>{review.user?.name ?? "SPORTSPHERE customer"}</span></article>)}</div>;
}

function CartPage() {
  const { cart, coupon, applyCoupon, removeCoupon, updateQuantity, removeFromCart, user } = useStore();
  const [couponCode, setCouponCode] = useState("");
  const subtotal = cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const kitDiscount = kitSavings(cart);
  const savings = couponSavings(coupon, subtotal - kitDiscount);
  const shipping = subtotal - kitDiscount - savings === 0 || subtotal - kitDiscount - savings >= 1500 ? 0 : 99;
  if (!user) return <main className="page-shell"><div className="empty-state"><span>◌</span><h2>Your bag is waiting.</h2><p>Sign in to see the items you’ve saved.</p><Link className="button button-dark" to="/login?next=/cart">Sign in to continue <ArrowRight size={16} /></Link></div></main>;
  return <main className="page-shell"><div className="page-intro compact-intro"><div className="eyebrow">YOUR PICKS / 02</div><h1>Your <em>bag.</em></h1></div>
    {!cart.length ? <div className="empty-state"><span>◌</span><h2>Good things start here.</h2><p>Your bag’s ready for your next big move.</p><Link className="button button-dark" to="/shop">Explore the collection <ArrowRight size={16} /></Link></div> : <div className="cart-layout"><div className="cart-items">{cart.map((item) => <article className="cart-row" key={item._id}><Link to={`/product/${item.product.slug}`} className="cart-image"><img src={item.product.images[0]} alt={item.product.name} /></Link><div className="cart-item-copy"><span className="eyebrow">{item.product.brand}{item.kitId ? " / SPORTS KIT" : ""}</span><Link to={`/product/${item.product.slug}`}><h3>{item.product.name}</h3></Link><span>{[item.size, item.color].filter(Boolean).join(" / ")}</span><div className="quantity-control"><button onClick={() => void updateQuantity(item._id, Math.max(1, item.quantity - 1))} aria-label="Decrease"><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => void updateQuantity(item._id, item.quantity + 1)} aria-label="Increase"><Plus size={13} /></button></div></div><div className="cart-item-total"><b>{money(item.product.price * item.quantity)}</b><button aria-label="Remove item" onClick={() => void removeFromCart(item._id)}><Trash2 size={16} /></button></div></article>)}</div>
      <aside className="summary-card"><span className="eyebrow">THE BREAKDOWN</span><h3>Order summary</h3><div><span>Subtotal</span><b>{money(subtotal)}</b></div>{kitDiscount > 0 && <div><span>Kit saving</span><b>-{money(kitDiscount)}</b></div>}<div className="coupon-widget">{coupon ? <><span><b>{coupon.code}</b> · {coupon.type === "percent" ? `${coupon.value}% off` : `${money(coupon.value)} off`}</span><button onClick={() => void removeCoupon()}>Remove</button></> : <form onSubmit={(event) => { event.preventDefault(); void applyCoupon(couponCode); }}><input placeholder="Coupon code" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} aria-label="Coupon code" /><button>Apply</button></form>}</div>{savings > 0 && <div><span>Coupon saving</span><b>-{money(savings)}</b></div>}<div><span>Delivery</span><b>{shipping ? money(shipping) : "FREE"}</b></div><div className="summary-total"><span>Total</span><b>{money(subtotal - kitDiscount - savings + shipping)}</b></div><p>{shipping ? `Add ${money(Math.max(0, 1500 - (subtotal - kitDiscount - savings)))} more for free delivery.` : "You’ve unlocked free delivery!"}</p><Link className="button button-dark full-button" to="/checkout">Go to checkout <ArrowRight size={16} /></Link><Link className="continue-shopping" to="/shop"><ArrowLeft size={14} /> Keep exploring</Link></aside>
    </div>}
  </main>;
}

function WishlistPage() {
  const { wishlist, user } = useStore();
  if (!user) return <Navigate to="/login?next=/wishlist" replace />;
  return <main className="page-shell"><div className="page-intro compact-intro"><span className="eyebrow">SAVED FOR LATER / 03</span><h1>Your <em>shortlist.</em></h1></div><ProductGrid products={wishlist} loading={false} empty="Your wishlist is waiting for its first favourite." /></main>;
}

function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { setUser } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const { data } = await api.post<{ user: SessionUser }>(`/auth/${mode}`, body);
      setUser(data.user);
      navigate(params.get("next") || "/");
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  return <main className="auth-page"><div className="auth-card"><span className="eyebrow">{mode === "login" ? "WELCOME BACK, MOVER" : "YOUR NEXT MOVE STARTS HERE"}</span><h1>{mode === "login" ? <>Good to<br /><em>see you.</em></> : <>Join the<br /><em>movement.</em></>}</h1><p>{mode === "login" ? "Sign in and get back to finding your next gear." : "Create an account to save favourites and check out faster."}</p>
    <form onSubmit={submit}>{mode === "register" && <label>Your name<input name="name" minLength={2} maxLength={80} required autoComplete="name" placeholder="Alex Morgan" /></label>}<label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label><label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={72} required placeholder="At least 8 characters" /></label>{mode === "register" && <label>Phone <span className="optional">(optional)</span><input name="phone" type="tel" maxLength={20} autoComplete="tel" placeholder="+91 98765 43210" /></label>}<button className="button button-dark full-button" disabled={busy}>{busy ? "One moment..." : mode === "login" ? "Sign in" : "Create account"} <ArrowRight size={16} /></button>{mode === "login" && <Link className="forgot-link" to="/forgot-password">Forgot your password?</Link>}{error && <div className="form-error">{error}</div>}</form><div className="auth-switch">{mode === "login" ? <>New to SportSphere? <Link to="/register">Create an account</Link></> : <>Already part of the movement? <Link to="/login">Sign in</Link></>}</div></div><div className="auth-art"><span>SS / MOVE WITH INTENT</span><img src="https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1000&q=85" alt="Athlete training" /><b>YOUR GAME.<br />YOUR GOODS.</b></div></main>;
}

function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(""); setMessage("");
    const email = new FormData(event.currentTarget).get("email");
    try {
      const { data } = await api.post<{ message: string }>("/auth/forgot-password", { email });
      setMessage(data.message);
    } catch (failure) { setError(errorMessage(failure)); }
  };
  return <main className="auth-page"><div className="auth-card"><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Back in<br /><em>the game.</em></h1><p>Enter the email for your account. If it’s registered, we’ll send a secure reset link.</p><form onSubmit={submit}><label>Email address<input name="email" type="email" required autoComplete="email" /></label><button className="button button-dark full-button">Send reset link <ArrowRight size={16} /></button>{error && <div className="form-error">{error}</div>}{message && <div className="success-banner">{message}</div>}</form><div className="auth-switch"><Link to="/login">Back to sign in</Link></div></div><div className="auth-art"><img src="https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1000&q=85" alt="Runner in motion" /></div></main>;
}

function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(""); setMessage("");
    const password = new FormData(event.currentTarget).get("password");
    try {
      const { data } = await api.post<{ message: string }>("/auth/reset-password", { token: params.get("token"), password });
      setMessage(data.message);
      window.setTimeout(() => navigate("/login"), 1200);
    } catch (failure) { setError(errorMessage(failure)); }
  };
  return <main className="auth-page"><div className="auth-card"><span className="eyebrow">ONE LAST STEP</span><h1>Set a new<br /><em>password.</em></h1><p>Choose a password with at least eight characters.</p><form onSubmit={submit}><label>New password<input name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></label><button className="button button-dark full-button">Update password <ArrowRight size={16} /></button>{error && <div className="form-error">{error}</div>}{message && <div className="success-banner">{message}</div>}</form></div><div className="auth-art"><img src="https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1000&q=85" alt="Training session" /></div></main>;
}

function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("This verification link is missing its token.");
      return;
    }
    api.post<{ message: string }>("/auth/verify-email", { token })
      .then(({ data }) => setMessage(data.message))
      .catch((failure: unknown) => setError(errorMessage(failure)));
  }, [params]);
  return <main className="auth-page"><div className="auth-card"><span className="eyebrow">ACCOUNT VERIFICATION</span><h1>One last<br /><em>step.</em></h1><p>We’re confirming the email address linked to your SPORTSPHERE account.</p>{message && <div className="success-banner">{message} <Link to="/profile">Go to your account</Link></div>}{error && <div className="form-error">{error}</div>}</div><div className="auth-art"><img src="https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1000&q=85" alt="Runner in motion" /></div></main>;
}

interface Address {
  _id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

function ProfilePage() {
  const { user, setUser, signOut } = useStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    api.get<{ addresses: Address[] }>("/auth/me/addresses").then(({ data }) => setAddresses(data.addresses)).catch((failure: unknown) => setError(errorMessage(failure)));
  }, [user]);
  if (!user) return <Navigate to="/login?next=/profile" replace />;
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMessage(""); setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const { data } = await api.patch<{ user: SessionUser }>("/auth/me", form);
      setUser(data.user);
      setMessage("Your profile has been updated.");
    } catch (failure) { setError(errorMessage(failure)); }
  };
  const addAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMessage(""); setError("");
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement).entries());
    try {
      const { data } = await api.post<{ addresses: Address[] }>("/auth/me/addresses", form);
      setAddresses(data.addresses);
      formElement.reset();
      setMessage("Delivery address saved.");
    } catch (failure) { setError(errorMessage(failure)); }
  };
  const deleteAddress = async (id: string) => {
    try {
      const { data } = await api.delete<{ addresses: Address[] }>(`/auth/me/addresses/${id}`);
      setAddresses(data.addresses);
      setMessage("Address removed.");
    } catch (failure) { setError(errorMessage(failure)); }
  };
  const resendVerification = async () => {
    setError(""); setMessage("");
    try {
      const { data } = await api.post<{ message: string }>("/auth/me/verification-email");
      setMessage(data.message);
    } catch (failure) { setError(errorMessage(failure)); }
  };
  return <main className="page-shell profile-page"><div className="page-intro compact-intro"><span className="eyebrow">YOUR ACCOUNT / 08</span><h1>Your <em>corner.</em></h1><p>Manage your details, delivery addresses and orders.</p></div><div className="profile-layout"><div>{!user.emailVerified && <section className="profile-section"><span className="eyebrow">EMAIL NOT VERIFIED</span><h2>Check your inbox.</h2><p>Verify {user.email} to confirm it belongs to you.</p><button className="button button-dark" onClick={() => void resendVerification()}>Resend verification email <ArrowRight size={15} /></button></section>}<section className="profile-section"><span className="eyebrow">THE BASICS</span><h2>Profile details</h2><form className="profile-form" onSubmit={saveProfile}><label>Full name<input name="name" defaultValue={user.name} minLength={2} maxLength={80} required /></label><label>Email<input value={user.email} disabled /></label><label>Phone<input name="phone" defaultValue={user.phone ?? ""} maxLength={20} /></label><button className="button button-dark">Save changes <Check size={15} /></button></form></section><section className="profile-section"><span className="eyebrow">READY WHEN YOU ARE</span><h2>Delivery addresses</h2>{addresses.map((address) => <article className="address-card" key={address._id}><div><b>{address.fullName}</b><p>{address.line1}{address.line2 ? `, ${address.line2}` : ""}<br />{address.city}, {address.state} {address.postalCode}<br />{address.country} · {address.phone}</p></div><button onClick={() => void deleteAddress(address._id)} aria-label="Remove address"><Trash2 size={16} /></button></article>)}<h3>Add an address</h3><form className="form-grid" onSubmit={addAddress}><label>Full name<input name="fullName" required minLength={2} /></label><label>Phone<input name="phone" required minLength={7} /></label><label className="span-two">Address<input name="line1" required minLength={3} /></label><label className="span-two">Apartment / landmark<input name="line2" /></label><label>City<input name="city" required /></label><label>State<input name="state" required /></label><label>Postal code<input name="postalCode" required minLength={4} /></label><label>Country<input name="country" defaultValue="India" required /></label><button className="button button-dark span-two">Save address <Plus size={15} /></button></form></section></div><aside className="profile-aside"><span className="eyebrow">QUICK LINKS</span><Link to="/orders">View your orders <ArrowRight size={15} /></Link><Link to="/wishlist">Your wishlist <ArrowRight size={15} /></Link><button onClick={() => void signOut()}>Sign out <ArrowRight size={15} /></button>{message && <div className="success-banner">{message}</div>}{error && <div className="form-error">{error}</div>}</aside></div></main>;
}

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on?: (event: string, handler: () => void) => void }; }
}

async function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function CheckoutPage() {
  const { cart, coupon, user, refreshCart } = useStore();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "cod">("razorpay");
  if (!user) return <Navigate to="/login?next=/checkout" replace />;
  const subtotal = cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const kitDiscount = kitSavings(cart);
  const savings = couponSavings(coupon, subtotal - kitDiscount);
  const checkout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const shippingAddress = Object.fromEntries(form.entries());
    try {
      const { data } = await api.post<{ order: Order }>("/orders", { shippingAddress, paymentMethod });
      await refreshCart();
      if (paymentMethod === "cod") {
        navigate(`/orders?created=${data.order.orderNumber}`);
        return;
      }
      const loaded = await loadRazorpay();
      if (!loaded || !window.Razorpay) throw new Error("Razorpay Checkout could not be loaded. Check your internet connection.");
      const paymentResponse = await api.post<{ keyId: string; razorpayOrderId: string; amount: number; currency: string }>("/payments/razorpay/order", { orderId: data.order._id });
      const options = {
        key: paymentResponse.data.keyId,
        amount: paymentResponse.data.amount,
        currency: paymentResponse.data.currency,
        name: "SPORTSPHERE",
        description: `Order ${data.order.orderNumber}`,
        order_id: paymentResponse.data.razorpayOrderId,
        prefill: { name: user.name, email: user.email, contact: user.phone },
        theme: { color: "#ff5a24" },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await api.post("/payments/razorpay/verify", { orderId: data.order._id, ...response });
            await refreshCart();
            navigate(`/orders?created=${data.order.orderNumber}`);
          } catch (failure) { setError(errorMessage(failure)); }
          finally { setBusy(false); }
        },
        modal: { ondismiss: () => { setBusy(false); setError("Payment was cancelled. Your order remains unpaid and can be retried from your orders."); } },
      };
      const checkout = new window.Razorpay(options);
      checkout.on?.("payment.failed", () => { setBusy(false); setError("Payment didn’t go through. You can try again from your orders."); });
      checkout.open();
    } catch (failure) { setError(errorMessage(failure)); setBusy(false); }
  };
  if (!cart.length) return <main className="page-shell"><div className="empty-state"><h2>Your cart is empty.</h2><Link className="button button-dark" to="/shop">Find your gear <ArrowRight size={16} /></Link></div></main>;
  return <main className="page-shell"><div className="page-intro compact-intro"><span className="eyebrow">ALMOST YOURS / 04</span><h1>Let’s get it <em>to you.</em></h1></div><form className="checkout-layout" onSubmit={checkout}><div className="checkout-fields"><section className="checkout-section"><span className="checkout-step">01</span><div><h2>Delivery details</h2><p>Where should we send your gear?</p></div><div className="form-grid"><label>Full name<input name="fullName" autoComplete="name" required minLength={2} /></label><label>Phone number<input name="phone" type="tel" autoComplete="tel" required minLength={7} /></label><label className="span-two">Address line 1<input name="line1" autoComplete="address-line1" required minLength={3} /></label><label className="span-two">Address line 2 <span className="optional">(optional)</span><input name="line2" autoComplete="address-line2" /></label><label>City<input name="city" autoComplete="address-level2" required /></label><label>State<input name="state" autoComplete="address-level1" required /></label><label>Postal code<input name="postalCode" autoComplete="postal-code" required minLength={4} /></label><label>Country<input name="country" defaultValue="India" autoComplete="country-name" required /></label></div></section>
    <section className="checkout-section"><span className="checkout-step">02</span><div><h2>How would you like to pay?</h2><p>All online payments are securely processed.</p></div><div className="payment-options"><label className={paymentMethod === "razorpay" ? "selected" : ""}><input type="radio" name="payment" checked={paymentMethod === "razorpay"} onChange={() => setPaymentMethod("razorpay")} /><span><b>Pay online with Razorpay</b><small>UPI, cards, net banking & more</small></span><span className="payment-badge">SECURE</span></label><label className={paymentMethod === "cod" ? "selected" : ""}><input type="radio" name="payment" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} /><span><b>Cash on delivery</b><small>Pay when your order arrives</small></span></label></div></section>{error && <div className="form-error">{error}</div>}</div>
    <aside className="summary-card"><span className="eyebrow">THE LAST CHECK</span><h3>Order summary</h3>{cart.map((item) => <div className="checkout-item" key={item._id}><img src={item.product.images[0]} alt="" /><span>{item.product.name} <small>× {item.quantity}</small></span><b>{money(item.product.price * item.quantity)}</b></div>)}<div><span>Subtotal</span><b>{money(subtotal)}</b></div>{kitDiscount > 0 && <div><span>Kit saving</span><b>-{money(kitDiscount)}</b></div>}{savings > 0 && <div><span>Coupon saving ({coupon?.code})</span><b>-{money(savings)}</b></div>}<div><span>Delivery</span><b>{subtotal - kitDiscount - savings >= 1500 ? "FREE" : money(99)}</b></div><div className="summary-total"><span>Total</span><b>{money(subtotal - kitDiscount - savings + (subtotal - kitDiscount - savings >= 1500 ? 0 : 99))}</b></div><button className="button button-dark full-button" disabled={busy}>{busy ? "Processing..." : paymentMethod === "cod" ? "Place cash-on-delivery order" : "Continue to secure payment"} <ArrowRight size={16} /></button><p className="secure-note">Your payment details are encrypted and secure.</p></aside></form></main>;
}

function OrdersPage() {
  const { user } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [busyOrder, setBusyOrder] = useState("");
  const [params] = useSearchParams();
  useEffect(() => {
    api.get<{ orders: Order[] }>("/orders/mine").then(({ data }) => setOrders(data.orders)).catch((failure: unknown) => setError(errorMessage(failure)));
  }, []);
  if (!user) return <Navigate to="/login?next=/orders" replace />;
  const retryPayment = async (order: Order) => {
    setBusyOrder(order._id); setError("");
    try {
      if (!(await loadRazorpay()) || !window.Razorpay) throw new Error("Razorpay Checkout could not be loaded.");
      const { data } = await api.post<{ keyId: string; razorpayOrderId: string; amount: number; currency: string }>("/payments/razorpay/order", { orderId: order._id });
      const checkout = new window.Razorpay({
        key: data.keyId, amount: data.amount, currency: data.currency, order_id: data.razorpayOrderId,
        name: "SPORTSPHERE", description: `Order ${order.orderNumber}`,
        prefill: { name: user.name, email: user.email, contact: user.phone },
        theme: { color: "#ff5a24" },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const result = await api.post<{ order: Order }>("/payments/razorpay/verify", { orderId: order._id, ...response });
            setOrders((current) => current.map((item) => item._id === order._id ? result.data.order : item));
          } catch (failure) { setError(errorMessage(failure)); }
          finally { setBusyOrder(""); }
        },
        modal: { ondismiss: () => setBusyOrder("") },
      });
      checkout.on?.("payment.failed", () => { setBusyOrder(""); setError("Payment didn’t go through. Please try again."); });
      checkout.open();
    } catch (failure) { setError(errorMessage(failure)); setBusyOrder(""); }
  };
  const cancelOrder = async (order: Order) => {
    setBusyOrder(order._id); setError("");
    try {
      const { data } = await api.post<{ order: Order }>(`/orders/${order._id}/cancel`);
      setOrders((current) => current.map((item) => item._id === order._id ? data.order : item));
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusyOrder(""); }
  };
  const downloadInvoice = async (order: Order) => {
    setBusyOrder(order._id); setError("");
    try {
      const { data } = await api.get<Blob>(`/orders/${order._id}/invoice`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `SPORTSPHERE-${order.orderNumber}-invoice.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusyOrder(""); }
  };
  return <main className="page-shell">
    <div className="page-intro compact-intro"><span className="eyebrow">YOUR JOURNEY / 05</span><h1>Every order,<br /><em>in motion.</em></h1></div>
    {params.get("created") && <div className="success-banner"><Check size={18} /> Order {params.get("created")} has been placed. Thanks for choosing SPORTSPHERE.</div>}
    {error && <div className="form-error">{error}</div>}
    {!orders.length && !error ? <div className="empty-state"><h2>No orders just yet.</h2><p>Your next great find is just around the corner.</p><Link className="button button-dark" to="/shop">Explore the collection <ArrowRight size={16} /></Link></div> :
      <div className="orders-list">{orders.map((order) => <article className="order-card" key={order._id}>
        <div className="order-heading"><div><span className="eyebrow">{order.orderNumber}</span><h3>{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</h3></div><span className={`status-pill status-${order.status}`}>{order.status}</span></div>
        <div className="order-products">{order.items.map((item, index) => <div key={`${order._id}-${index}`}><img src={item.image} alt="" /><span>{item.name} <small>× {item.quantity}</small></span><b>{money(item.unitPrice * item.quantity)}</b></div>)}</div>
        <div className="order-bottom"><span>Payment: {order.paymentMethod === "cod" ? "Cash on delivery" : "Razorpay"} / {order.paymentStatus}</span><b>Total {money(order.total)}</b></div>
        {order.trackingNumber && <div className="delivery-card"><span>↗</span><div><b>{order.carrier || "Shipment"} · {order.trackingNumber}</b><p>{order.shippedAt ? `Shipped ${new Date(order.shippedAt).toLocaleDateString("en-IN")}` : "Tracking information is available."}{order.trackingUrl && <> · <a href={order.trackingUrl} target="_blank" rel="noreferrer">Track shipment</a></>}</p></div></div>}
        <div className="order-actions"><button className="button button-plain" disabled={busyOrder === order._id} onClick={() => void downloadInvoice(order)}>Download invoice <ArrowDownRight size={15} /></button></div>
        <div className="order-actions">{order.paymentMethod === "razorpay" && order.paymentStatus !== "paid" && order.status !== "cancelled" && <button className="button button-dark" disabled={busyOrder === order._id} onClick={() => void retryPayment(order)}>{busyOrder === order._id ? "Opening payment..." : "Retry payment"} <ArrowRight size={15} /></button>}{["pending", "confirmed", "processing"].includes(order.status) && order.paymentStatus !== "paid" && <button className="cancel-order" disabled={busyOrder === order._id} onClick={() => void cancelOrder(order)}>Cancel order</button>}</div>
      </article>)}</div>}
  </main>;
}

function KitBuilderPage() {
  const [sport, setSport] = useState("Cricket");
  const [selected, setSelected] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const { addKit } = useStore();
  useEffect(() => {
    api.get<{ products: Product[] }>(`/products?sport=${encodeURIComponent(sport)}&limit=48`).then(({ data }) => setProducts(data.products)).catch((failure: unknown) => setError(errorMessage(failure)));
  }, [sport]);
  const chosen = products.filter((product) => selected.includes(product._id));
  const total = chosen.reduce((sum, product) => sum + product.price * (quantities[product._id] ?? 1), 0);
  const kitItemCount = chosen.reduce((sum, product) => sum + (quantities[product._id] ?? 1), 0);
  const kitDiscount = kitItemCount >= 3 ? total * 0.1 : 0;
  const canAddKit = chosen.length > 0 && chosen.every((product) => !product.sizes.length || sizes[product._id]);
  const submitKit = () => addKit(sport, chosen.map((product) => ({ productId: product._id, quantity: quantities[product._id] ?? 1, size: sizes[product._id], color: product.colors[0] })));
  return <main className="page-shell kit-page"><div className="page-intro"><span className="eyebrow">SPORTSPHERE LAB / 06</span><h1>Build your<br /><em>sports kit.</em></h1><p>Your sport. Your setup. Your game-day ritual. Pick a sport and choose the pieces you need.</p></div><div className="kit-sport-tabs">{sports.slice(0, 6).map((item, index) => <button className={sport === item ? "active" : ""} key={item} onClick={() => { setSport(item); setSelected([]); }}><span>0{index + 1}</span>{item}</button>)}</div>{error ? <div className="notice-box">{error}</div> : <div className="kit-layout"><div><div className="kit-heading"><span className="eyebrow">PICK YOUR ESSENTIALS</span><span>{selected.length} selected</span></div><div className="kit-products">{products.map((product) => <div className={`kit-product ${selected.includes(product._id) ? "selected" : ""}`} key={product._id}><input type="checkbox" checked={selected.includes(product._id)} aria-label={`Add ${product.name} to kit`} onChange={() => setSelected((current) => current.includes(product._id) ? current.filter((id) => id !== product._id) : [...current, product._id])} /><ProductImage product={product} /><span><b>{product.name}</b><small>{product.category} / {product.brand}</small>{selected.includes(product._id) && product.sizes.length > 0 && <select aria-label={`Size for ${product.name}`} value={sizes[product._id] ?? ""} onChange={(event) => setSizes((current) => ({ ...current, [product._id]: event.target.value }))}><option value="">Choose size</option>{product.sizes.map((size) => <option key={size}>{size}</option>)}</select>}</span>{selected.includes(product._id) && <div className="kit-quantity"><select aria-label={`Quantity for ${product.name}`} value={quantities[product._id] ?? 1} onChange={(event) => setQuantities((current) => ({ ...current, [product._id]: Number(event.target.value) }))}>{[1, 2, 3, 4, 5].map((quantity) => <option key={quantity} value={quantity}>×{quantity}</option>)}</select></div>}<strong>{money(product.price * (quantities[product._id] ?? 1))}</strong></div>)}</div></div><aside className="summary-card kit-summary"><span className="eyebrow">YOUR GAME PLAN</span><h3>{sport} kit</h3>{chosen.length ? chosen.map((item) => <div key={item._id}><span>{item.name} × {quantities[item._id] ?? 1}</span><b>{money(item.price * (quantities[item._id] ?? 1))}</b></div>) : <p>Pick a few pieces. We’ll add them up here.</p>}<div><span>Kit saving {kitItemCount >= 3 ? "(10%)" : "(unlock with 3+ items)"}</span><b>-{money(kitDiscount)}</b></div><div className="summary-total"><span>Kit total</span><b>{money(total - kitDiscount)}</b></div><button className="button button-dark full-button" disabled={!canAddKit} onClick={() => void submitKit()}>Add kit to bag <ShoppingBag size={16} /></button><small>Pick three or more pieces to save 10% on your kit.</small></aside></div>}</main>;
}

function ComparePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let ids: string[] = [];
    try { ids = JSON.parse(localStorage.getItem("sportsphere-compare") ?? "[]") as string[]; } catch { ids = []; }
    Promise.all(ids.slice(0, 4).map((id) => api.get<{ product: Product }>(`/products/${id}`).then(({ data }) => data.product)))
      .then(setProducts).catch((failure: unknown) => setError(errorMessage(failure)));
  }, []);
  const fields: Array<[string, (product: Product) => ReactNode]> = [
    ["Brand", (product) => product.brand],
    ["Price", (product) => money(product.price)],
    ["Rating", (product) => <span className="table-rating"><Star size={13} fill="currentColor" /> {product.rating.toFixed(1)} / 5</span>],
    ["Category", (product) => product.category],
    ["Sport", (product) => product.sport],
    ["Sizes", (product) => product.sizes.join(", ") || "One size"],
    ["Colours", (product) => product.colors.join(", ") || "—"],
    ["Stock", (product) => product.stock ? "Available" : "Sold out"],
    ["Specifications", (product) => Object.entries(product.specifications ?? {}).map(([key, value]) => <div key={key}><b>{key}:</b> {value}</div>)],
    ["Details", (product) => product.description],
  ];
  return <main className="page-shell"><div className="page-intro compact-intro"><span className="eyebrow">SIDE BY SIDE / 07</span><h1>Choose your<br /><em>champion.</em></h1><p>Pick up to four products with the Compare button on a product card.</p></div>{error && <div className="form-error">{error}</div>}{products.length ? <div className="compare-table-wrap"><table className="compare-table"><thead><tr><th>THE DETAILS</th>{products.map((product) => <th key={product._id}><Link to={`/product/${product.slug}`}><img src={product.images[0]} alt="" /><b>{product.name}</b></Link><button onClick={() => { const ids = products.map((item) => item._id).filter((id) => id !== product._id); localStorage.setItem("sportsphere-compare", JSON.stringify(ids)); setProducts(products.filter((item) => item._id !== product._id)); }}>Remove</button></th>)}</tr></thead><tbody>{fields.map(([label, render]) => <tr key={label}><th>{label}</th>{products.map((product) => <td key={product._id}>{render(product)}</td>)}</tr>)}</tbody></table></div> : <div className="empty-state"><span>⇄</span><h2>Your line-up’s empty.</h2><p>Compare a few products to find the right fit.</p><Link className="button button-dark" to="/shop">Browse products <ArrowRight size={16} /></Link></div>}</main>;
}

function VariantInventoryPanel({ product, onSaved }: { product: Product; onSaved: (stock: number) => void }) {
  const [values, setValues] = useState<Record<string, number>>({});
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const sizes = product.sizes.length ? product.sizes : [""];
  const colors = product.colors.length ? product.colors : [""];
  const rows = sizes.flatMap((size) => colors.map((color) => ({ size, color, key: `${size}\u0000${color}` })));

  useEffect(() => {
    let active = true;
    api.get<{ variants: ProductVariant[] }>(`/admin/products/${product._id}/variants`)
      .then(({ data }) => {
        if (!active) return;
        const inventory: Record<string, number> = {};
        data.variants.forEach((variant) => { inventory[`${variant.size}\u0000${variant.color}`] = variant.stock; });
        if (!data.variants.length) {
          const base = Math.floor(product.stock / rows.length);
          let remainder = product.stock % rows.length;
          rows.forEach(({ key }) => {
            inventory[key] = base + (remainder > 0 ? 1 : 0);
            remainder -= 1;
          });
        }
        setValues(inventory);
        setConfigured(data.variants.length > 0);
      })
      .catch((failure: unknown) => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, [product._id, product.stock, product.sizes, product.colors]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await api.put<{ variants: ProductVariant[]; stock: number }>(`/admin/products/${product._id}/variants`, {
        variants: rows.map(({ size, color, key }) => ({ size, color, stock: values[key] ?? 0 })),
      });
      setValues(Object.fromEntries(data.variants.map((variant) => [`${variant.size}\u0000${variant.color}`, variant.stock])));
      setConfigured(true);
      onSaved(data.stock);
      setMessage("Variant inventory saved.");
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  const useProductStock = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      await api.delete(`/admin/products/${product._id}/variants`);
      setConfigured(false);
      setMessage("Using product-level stock again.");
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };

  return <section className="variant-inventory"><div><span className="eyebrow">SIZE / COLOUR STOCK</span><p>{configured ? "Each option combination has its own sellable quantity." : "Save quantities to enable separate stock for each option combination. Current stock is distributed as a starting point."}</p></div><form onSubmit={save}><div className="variant-stock-grid">{rows.map(({ size, color, key }) => <label key={key}>{size || "One size"} · {color || "Standard"}<input aria-label={`Stock for ${size || "one size"}, ${color || "standard"}`} type="number" min="0" max="1000000" step="1" required value={values[key] ?? 0} onChange={(event) => setValues((current) => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}</div><div className="variant-actions"><button className="button button-dark" disabled={busy}>{busy ? "Saving..." : "Save variant stock"}</button>{configured && <button className="cancel-order" type="button" disabled={busy} onClick={() => void useProductStock()}>Switch to shared stock</button>}</div>{message && <small className="variant-success">{message}</small>}{error && <div className="form-error">{error}</div>}</form></section>;
}

function AdminPage() {
  const { user } = useStore();
  type AdminOrder = { _id: string; orderNumber: string; total: number; status: string; paymentStatus: string; carrier?: string; trackingNumber?: string; trackingUrl?: string };
  const [dashboard, setDashboard] = useState<{ revenue: number; orderCount: number; customerCount: number; productCount: number; lowStock: number } | null>(null);
  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [adminCategories, setAdminCategories] = useState<Array<{ _id: string; name: string; slug: string }>>([]);
  const [adminOrders, setAdminOrders] = useState<AdminOrder[]>([]);
  const [adminReviews, setAdminReviews] = useState<Array<{ _id: string; approved: boolean; rating: number; body: string; user?: { name: string }; product?: { name: string } }>>([]);
  const [adminCoupons, setAdminCoupons] = useState<Array<{ _id: string; code: string; type: "percent" | "fixed"; value: number; minimumSpend: number; active: boolean }>>([]);
  const [customers, setCustomers] = useState<Array<{ _id: string; name: string; email: string }>>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [inventoryProductId, setInventoryProductId] = useState("");
  const [imageUrls, setImageUrls] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setImageUrls(editingProduct?.images.join(", ") ?? "");
  }, [editingProduct]);
  useEffect(() => {
    if (user?.role !== "admin") return;
    Promise.all([
      api.get("/admin/dashboard"),
      api.get<{ products: Product[] }>("/products?limit=48"),
      api.get<{ categories: Array<{ _id: string; name: string; slug: string }> }>("/admin/categories"),
      api.get<{ orders: AdminOrder[] }>("/orders/admin/all"),
      api.get<{ reviews: typeof adminReviews }>("/admin/reviews"),
      api.get<{ customers: Array<{ _id: string; name: string; email: string }> }>("/admin/customers"),
      api.get<{ coupons: typeof adminCoupons }>("/admin/coupons"),
    ]).then(([overview, productResult, categoryResult, orderResult, reviewResult, customerResult, couponResult]) => {
      setDashboard(overview.data);
      setAdminProducts(productResult.data.products);
      setAdminCategories(categoryResult.data.categories);
      setAdminOrders(orderResult.data.orders);
      setAdminReviews(reviewResult.data.reviews);
      setCustomers(customerResult.data.customers);
      setAdminCoupons(couponResult.data.coupons);
    }).catch((failure: unknown) => setError(errorMessage(failure)));
  }, [user]);
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (user.role !== "admin") return <main className="page-shell"><div className="notice-box">Admin access is restricted to authorised administrators.</div></main>;
  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    const splitList = (value: FormDataEntryValue | undefined) => String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    const body = {
      name: String(form.name), slug: String(form.slug), brand: String(form.brand), category: String(form.category), sport: String(form.sport),
      description: String(form.description), images: splitList(form.images), price: Number(form.price), compareAtPrice: Number(form.compareAtPrice),
      stock: Number(form.stock), sizes: splitList(form.sizes), colors: splitList(form.colors), specifications: {},
      featured: form.featured === "on",
    };
    try {
      const { data } = editingProduct
        ? await api.patch<{ product: Product }>(`/admin/products/${editingProduct._id}`, body)
        : await api.post<{ product: Product }>("/admin/products", body);
      setAdminProducts((current) => editingProduct ? current.map((item) => item._id === data.product._id ? data.product : item) : [data.product, ...current]);
      setEditingProduct(null);
      setMessage(editingProduct ? "Product updated." : "Product created.");
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  const deleteProduct = async (product: Product) => {
    setError(""); setMessage("");
    try {
      await api.delete(`/admin/products/${product._id}`);
      setAdminProducts((current) => current.filter((item) => item._id !== product._id));
      setMessage("Product removed.");
    } catch (failure) { setError(errorMessage(failure)); }
  };
  const uploadProductImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setError("Choose an image file smaller than 10 MB.");
      return;
    }
    setUploadingImage(true); setError(""); setMessage("");
    try {
      const { data: credentials } = await api.post<{ cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string }>("/admin/upload-signature");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", credentials.apiKey);
      formData.append("timestamp", String(credentials.timestamp));
      formData.append("folder", credentials.folder);
      formData.append("signature", credentials.signature);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/upload`, { method: "POST", body: formData });
      if (!response.ok) throw new Error("Cloudinary could not upload this image.");
      const result: unknown = await response.json();
      if (typeof result !== "object" || result === null || !("secure_url" in result) || typeof result.secure_url !== "string") {
        throw new Error("Cloudinary returned an invalid image response.");
      }
      setImageUrls((current) => [current, result.secure_url].filter(Boolean).join(", "));
      setMessage("Image uploaded securely.");
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setUploadingImage(false); }
  };
  const createCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setMessage("");
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement).entries());
    try {
      const { data } = await api.post<{ category: { _id: string; name: string; slug: string } }>("/admin/categories", form);
      setAdminCategories((current) => [...current, data.category].sort((a, b) => a.name.localeCompare(b.name)));
      formElement.reset();
      setMessage("Category created.");
    } catch (failure) { setError(errorMessage(failure)); }
  };
  const deleteCategory = async (category: { _id: string; name: string; slug: string }) => {
    try {
      await api.delete(`/admin/categories/${category._id}`);
      setAdminCategories((current) => current.filter((item) => item._id !== category._id));
      setMessage("Category removed.");
    } catch (failure) { setError(errorMessage(failure)); }
  };
  const editCategory = async (category: { _id: string; name: string; slug: string }) => {
    const name = window.prompt("New category name", category.name)?.trim();
    if (!name || name === category.name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    try {
      const { data } = await api.patch<{ category: { _id: string; name: string; slug: string } }>(`/admin/categories/${category._id}`, { name, slug });
      setAdminCategories((current) => current.map((item) => item._id === category._id ? data.category : item));
      setMessage("Category updated.");
    } catch (failure) { setError(errorMessage(failure)); }
  };
  const createCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setMessage("");
    const formElement = event.currentTarget;
    const data = Object.fromEntries(new FormData(formElement).entries());
    const payload = { code: data.code, type: data.type, value: Number(data.value), minimumSpend: Number(data.minimumSpend || 0) };
    try {
      const { data: result } = await api.post<{ coupon: typeof adminCoupons[number] }>("/admin/coupons", payload);
      setAdminCoupons((current) => [result.coupon, ...current]);
      formElement.reset();
      setMessage("Coupon created.");
    } catch (failure) { setError(errorMessage(failure)); }
  };
  const toggleCoupon = async (coupon: typeof adminCoupons[number]) => {
    try {
      const { data } = await api.patch<{ coupon: typeof adminCoupons[number] }>(`/admin/coupons/${coupon._id}`, { active: !coupon.active });
      setAdminCoupons((current) => current.map((item) => item._id === coupon._id ? data.coupon : item));
    } catch (failure) { setError(errorMessage(failure)); }
  };
  const updateOrderStatus = async (id: string, status: string) => {
    try {
      const { data } = await api.patch<{ order: { status: string } }>(`/orders/admin/${id}/status`, { status });
      setAdminOrders((current) => current.map((order) => order._id === id ? { ...order, status: data.order.status } : order));
    } catch (failure) { setError(errorMessage(failure)); }
  };
  const updateTracking = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const { data } = await api.patch<{ order: AdminOrder }>(`/orders/admin/${id}/tracking`, form);
      setAdminOrders((current) => current.map((order) => order._id === id ? { ...order, ...data.order } : order));
      setMessage("Shipment tracking saved.");
    } catch (failure) { setError(errorMessage(failure)); }
  };
  const moderateReview = async (id: string, approved: boolean) => {
    try {
      await api.patch(`/admin/reviews/${id}`, { approved });
      setAdminReviews((current) => current.map((review) => review._id === id ? { ...review, approved } : review));
    } catch (failure) { setError(errorMessage(failure)); }
  };
  return <main className="page-shell admin-page">
    <div className="page-intro compact-intro"><span className="eyebrow">SPORTSPHERE / CONTROL ROOM</span><h1>Good morning,<br /><em>admin.</em></h1></div>
    {error && <div className="form-error admin-feedback">{error}</div>}{message && <div className="success-banner admin-feedback">{message}</div>}
    {dashboard ? <div className="admin-stats">{[["NET REVENUE", money(dashboard.revenue)], ["ORDERS", String(dashboard.orderCount)], ["CUSTOMERS", String(dashboard.customerCount)], ["PRODUCTS", String(dashboard.productCount)], ["LOW STOCK", String(dashboard.lowStock)]].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div> : <div className="skeleton" />}
    <section className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow">CATALOGUE</span><h2>{editingProduct ? "Edit product" : "Add a product"}</h2></div>{editingProduct && <button className="cancel-order" onClick={() => setEditingProduct(null)}>Cancel edit</button>}</div>
      <form className="admin-product-form" key={editingProduct?._id ?? "new-product"} onSubmit={saveProduct}>
        <label>Product name<input name="name" defaultValue={editingProduct?.name} required minLength={2} maxLength={160} /></label>
        <label>URL slug<input name="slug" defaultValue={editingProduct?.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
        <label>Brand<input name="brand" defaultValue={editingProduct?.brand} required /></label>
        <label>Category<select name="category" defaultValue={editingProduct?.category ?? adminCategories[0]?.name ?? ""} required>{adminCategories.map((item) => <option key={item._id}>{item.name}</option>)}</select></label>
        <label>Sport<input name="sport" defaultValue={editingProduct?.sport} required /></label>
        <label>Price (₹)<input name="price" type="number" min="0" step="1" defaultValue={editingProduct?.price} required /></label>
        <label>Original price (₹)<input name="compareAtPrice" type="number" min="0" step="1" defaultValue={editingProduct?.compareAtPrice} required /></label>
        <label>Stock<input name="stock" type="number" min="0" step="1" defaultValue={editingProduct?.stock ?? 0} required /></label>
        <label className="admin-wide">Image URL(s), comma-separated<input name="images" type="text" value={imageUrls} onChange={(event) => setImageUrls(event.target.value)} required /><small>Or upload a product photo (max 10 MB)</small><input type="file" accept="image/*" onChange={uploadProductImage} disabled={uploadingImage} />{uploadingImage && <small>Uploading securely...</small>}</label>
        <label className="admin-wide">Description<textarea name="description" defaultValue={editingProduct?.description} required minLength={10} maxLength={2000} /></label>
        <label>Sizes, comma-separated<input name="sizes" defaultValue={editingProduct?.sizes.join(",")} /></label>
        <label>Colours, comma-separated<input name="colors" defaultValue={editingProduct?.colors.join(",")} /></label>
        <label className="admin-checkbox"><input type="checkbox" name="featured" defaultChecked={editingProduct?.featured} /> Feature this product</label>
        <button className="button button-dark" disabled={busy}>{busy ? "Saving..." : editingProduct ? "Save changes" : "Create product"} <ArrowRight size={15} /></button>
      </form>
      <div className="admin-table">{adminProducts.map((product) => <div key={product._id}><div className="admin-row"><img src={product.images[0]} alt="" /><span><b>{product.name}</b><small>{product.brand} / {product.category} / Stock: {product.stock}</small></span><strong>{money(product.price)}</strong><button onClick={() => { setEditingProduct(product); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button><button onClick={() => setInventoryProductId((id) => id === product._id ? "" : product._id)}>{inventoryProductId === product._id ? "Close stock" : "Inventory"}</button><button className="admin-delete" onClick={() => void deleteProduct(product)}>Delete</button></div>{inventoryProductId === product._id && <VariantInventoryPanel key={product._id} product={product} onSaved={(stock) => setAdminProducts((current) => current.map((item) => item._id === product._id ? { ...item, stock } : item))} />}</div>)}</div>
    </section>
    <div className="admin-two-column">    <section className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow">SHOP ORGANISATION</span><h2>Categories</h2></div></div><form className="category-form" onSubmit={createCategory}><input name="name" placeholder="Category name" required minLength={2} /><input name="slug" placeholder="url-slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /><button className="button button-dark">Add</button></form>{adminCategories.map((category) => <div className="simple-admin-row" key={category._id}><span>{category.name}</span><small>{category.slug}</small><button onClick={() => void editCategory(category)}>Rename</button><button onClick={() => void deleteCategory(category)}>Remove</button></div>)}</section>
      <section className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow">CUSTOMER CARE</span><h2>Recent orders</h2></div></div>{adminOrders.slice(0, 12).map((order) => <div className="simple-admin-row tracking-admin-row" key={order._id}><span>{order.orderNumber}<small>{money(order.total)} / {order.paymentStatus}</small></span><select value={order.status} onChange={(event) => void updateOrderStatus(order._id, event.target.value)}>{["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].map((status) => <option key={status}>{status}</option>)}</select><form className="tracking-form" onSubmit={(event) => void updateTracking(event, order._id)}><input name="carrier" aria-label="Carrier" placeholder="Carrier" defaultValue={order.carrier ?? ""} maxLength={80} /><input name="trackingNumber" aria-label="Tracking number" placeholder="Tracking number" defaultValue={order.trackingNumber ?? ""} maxLength={120} /><input name="trackingUrl" aria-label="HTTPS tracking URL" placeholder="HTTPS tracking URL (optional)" defaultValue={order.trackingUrl ?? ""} type="url" /><button className="button button-plain">Save tracking</button></form></div>)}</section></div>
    <div className="admin-two-column"><section className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow">COMMUNITY</span><h2>Review moderation</h2></div></div>{adminReviews.map((review) => <div className="review-admin-row" key={review._id}><span><b>{review.product?.name ?? "Product"}</b><small>{review.user?.name ?? "Customer"} · {review.rating}/5</small><p>{review.body}</p></span><button className="button button-plain" onClick={() => void moderateReview(review._id, !review.approved)}>{review.approved ? "Unpublish" : "Approve"}</button></div>)}</section>
      <section className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow">THE MOVEMENT</span><h2>Customers</h2></div></div>{customers.slice(0, 30).map((customer) => <div className="simple-admin-row" key={customer._id}><span>{customer.name}<small>{customer.email}</small></span></div>)}</section></div>
    <section className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow">A LITTLE EXTRA</span><h2>Coupons</h2></div></div><form className="coupon-admin-form" onSubmit={createCoupon}><input name="code" placeholder="WELCOME10" required pattern="[A-Za-z0-9_-]+" /><select name="type"><option value="percent">% off</option><option value="fixed">₹ off</option></select><input name="value" type="number" min="0.01" step="0.01" placeholder="Amount" required /><input name="minimumSpend" type="number" min="0" placeholder="Min spend ₹" /><button className="button button-dark">Create coupon</button></form>{adminCoupons.map((coupon) => <div className="simple-admin-row" key={coupon._id}><span>{coupon.code}<small>{coupon.type === "percent" ? `${coupon.value}%` : money(coupon.value)} off / min. {money(coupon.minimumSpend)}</small></span><b>{coupon.active ? "Active" : "Paused"}</b><button onClick={() => void toggleCoupon(coupon)}>{coupon.active ? "Pause" : "Activate"}</button></div>)}</section>
  </main>;
}

function NotFound() {
  return <main className="empty-state page-shell"><span>404</span><h1>Off the beaten track.</h1><p>We couldn’t find the page you were looking for.</p><Link className="button button-dark" to="/">Back to home <ArrowRight size={16} /></Link></main>;
}

export default function App() {
  return <><Header /><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/shop" element={<ShopPage />} />
    <Route path="/product/:slug" element={<ProductPage />} />
    <Route path="/cart" element={<CartPage />} />
    <Route path="/wishlist" element={<WishlistPage />} />
    <Route path="/checkout" element={<CheckoutPage />} />
    <Route path="/orders" element={<OrdersPage />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/kit-builder" element={<KitBuilderPage />} />
    <Route path="/compare" element={<ComparePage />} />
    <Route path="/admin" element={<AdminPage />} />
    <Route path="*" element={<NotFound />} />
  </Routes><Footer /><Toast /></>;
}
