import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, Car, Image as ImageIcon, Settings, CheckCircle2, X, Plus, 
  LogOut, MessageCircle, ArrowRight, ShieldCheck, Trash2, Tag, 
  ChevronRight, Clock, Package, AlertCircle, RefreshCw
} from 'lucide-react';
import { 
  collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, 
  updateDoc, doc, deleteDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { BrowserRouter, Routes, Route, useNavigate, Link, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';

// --- Types ---
interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  description: string;
  category: 'Logo' | 'Livery' | 'Car';
  status?: 'Available' | 'Sold Out';
}

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  productId: string;
  productName: string;
  totalAmount: number;
  status: 'Ordered' | 'Confirmed' | 'Cancelled' | 'Shipped' | 'Delivered';
  createdAt: any;
}

// --- Navbar ---

const Navbar = () => {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-luxury-black/80 backdrop-blur-md border-b border-luxury-gold/20">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 cursor-pointer">
          <Car className="text-luxury-gold w-8 h-8" />
          <span className="font-serif italic text-2xl font-bold tracking-tighter text-luxury-gold">CPM Luxury</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link 
            to="/"
            className={`text-sm font-medium transition-colors ${location.pathname === '/' ? 'text-luxury-gold' : 'text-gray-400 hover:text-white'}`}
          >
            Marketplace
          </Link>
          <Link 
            to="/admin/login"
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${isAdminPath ? 'text-luxury-gold' : 'text-gray-400 hover:text-white'}`}
          >
            <Settings size={16} />
            Admin
          </Link>
        </div>
      </div>
    </nav>
  );
};

function ProductCard({ product, onBuy }: { product: Product; onBuy: (p: Product) => void }) {
  const isSoldOut = product.status === 'Sold Out';

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group bg-luxury-dark border border-gray-800 rounded-2xl overflow-hidden hover:border-luxury-gold/50 transition-all duration-500 ${isSoldOut ? 'opacity-70 grayscale-[0.5]' : ''}`}
    >
      <div className="relative aspect-video overflow-hidden">
        <img 
          src={product.imageUrl} 
          alt={product.name} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="px-2 py-1 bg-luxury-black/60 backdrop-blur-md text-[10px] uppercase tracking-widest font-bold border border-luxury-gold/30 rounded text-luxury-gold">
            {product.category}
          </span>
          {isSoldOut && (
            <span className="px-2 py-1 bg-red-600 backdrop-blur-md text-[10px] uppercase tracking-widest font-bold border border-red-400 rounded text-white">
              SOLD OUT
            </span>
          )}
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-serif text-xl mb-1 group-hover:text-luxury-gold transition-colors">{product.name}</h3>
        <p className="text-gray-500 text-sm mb-4 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-mono text-luxury-gold font-bold">₹{product.price}</span>
          <button 
            disabled={isSoldOut}
            onClick={() => onBuy(product)}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${isSoldOut ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-luxury-gold text-luxury-black hover:bg-gold-light'}`}
          >
            {isSoldOut ? 'Unavailable' : 'Buy Now'} {!isSoldOut && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const OrderModal = ({ product, onClose, onSuccess }: { product: Product, onClose: () => void, onSuccess: () => void }) => {
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Save to Firestore
      const path = 'orders';
      let orderRef;
      try {
        orderRef = await addDoc(collection(db, path), {
          customerName: formData.name,
          customerPhone: formData.phone,
          address: formData.address,
          productId: product.id,
          productName: product.name,
          totalAmount: product.price,
          status: 'Ordered',
          createdAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }

      // 2. Notify via WhatsApp
      const targetNumber = localStorage.getItem('cpm_admin_number') || '918075305103'; // Default or from local storage
      try {
        await axios.post('/api/notify-order', {
          order: { 
            customerName: formData.name, 
            customerPhone: formData.phone, 
            address: formData.address,
            productName: product.name, 
            totalAmount: product.price 
          },
          targetNumber
        });
      } catch (err: any) {
        console.error("WA Notify failed:", err.response?.data || err.message);
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Order failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-luxury-dark border border-luxury-gold/30 rounded-3xl p-8 max-w-md w-full"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X /></button>
        <h2 className="font-serif text-3xl mb-2 text-luxury-gold">Secure Checkout</h2>
        <p className="text-gray-400 mb-6 text-sm">Product: <span className="text-white font-medium">{product.name}</span></p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1 font-bold">Full Name</label>
            <input 
              required
              className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-luxury-gold transition-colors"
              placeholder="e.g. Rahul Sharma"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1 font-bold">WhatsApp Number</label>
            <input 
              required
              className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-luxury-gold transition-colors"
              placeholder="e.g. 919876543210"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1 font-bold">Delivery Info (ID/Account)</label>
            <textarea 
              required
              rows={3}
              className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-luxury-gold transition-colors"
              placeholder="Enter your CPM ID or contact info for delivery"
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <div className="pt-4">
            <button 
              disabled={loading}
              className="w-full bg-luxury-gold text-luxury-black py-4 rounded-xl font-bold text-lg hover:bg-gold-light transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Processing...' : `Confirm Order (₹${product.price} COD)`}
            </button>
            <p className="text-center text-[10px] text-gray-600 mt-4 uppercase tracking-tighter">
               By clicking, you agree to our terms of service and COD policy.
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const Home = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(docs);
    });
  }, []);

  return (
    <div className="pt-32 pb-20 px-4 max-w-7xl mx-auto">
      <div className="text-center mb-20 relative">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block px-3 py-1 bg-luxury-gold/10 border border-luxury-gold/20 rounded-full mb-6"
        >
          <span className="text-xs uppercase tracking-[0.3em] font-bold text-luxury-gold">Most Beautiful CPM Marketplace</span>
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-6xl md:text-8xl font-serif mb-6 leading-tight"
        >
          Exclusive Logos <br /> <span className="italic text-luxury-gold">& Liveries</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-gray-400 max-w-2xl mx-auto text-lg"
        >
          Browse over 100+ premium designs for Car Parking Multiplayer. 
          Instant WhatsApp notifications and real COD support.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {products.map(product => (
          /* @ts-ignore */
          <ProductCard key={product.id} product={product} onBuy={setSelectedProduct} />
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-3xl">
           <ImageIcon className="mx-auto text-gray-700 w-12 h-12 mb-4" />
           <p className="text-gray-500 italic">No products available yet. Check back soon or visit Admin to upload.</p>
        </div>
      )}

      <AnimatePresence>
        {selectedProduct && (
          <OrderModal 
            product={selectedProduct} 
            onClose={() => setSelectedProduct(null)} 
            onSuccess={() => {
              setSelectedProduct(null);
              setShowSuccess(true);
            }}
          />
        )}
        {showSuccess && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-black/90">
            <motion.div 
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="text-center"
            >
               <div className="w-24 h-24 bg-luxury-gold rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(212,175,55,0.4)]">
                 <CheckCircle2 size={48} className="text-luxury-black" />
               </div>
               <h2 className="text-5xl font-serif mb-4">Order Successful!</h2>
               <p className="text-gray-400 text-lg mb-10">We have received your order. We will contact you on WhatsApp shortly.</p>
               <button 
                onClick={() => setShowSuccess(false)}
                className="bg-white text-black px-10 py-4 rounded-full font-bold hover:bg-luxury-gold transition-colors"
               >
                 Continue Shopping
               </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminLogin = () => {
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'admin123') {
            sessionStorage.setItem('is_admin', 'true');
            navigate('/admin/dashboard');
        } else {
            alert('Wrong password!');
        }
    };

    return (
        <div className="pt-40 pb-20 px-4 max-w-md mx-auto text-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-luxury-dark border border-luxury-gold/30 p-10 rounded-3xl">
                <ShieldCheck className="mx-auto text-luxury-gold w-16 h-16 mb-6" />
                <h2 className="font-serif text-3xl mb-8 font-bold">Admin Portal</h2>
                <form onSubmit={handleLogin} className="space-y-6">
                    <input 
                        type="password"
                        placeholder="Enter Master Password"
                        className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-4 text-center text-xl tracking-[0.5em] focus:border-luxury-gold focus:outline-none"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    <button className="w-full bg-luxury-gold text-luxury-black py-4 rounded-xl font-bold hover:bg-gold-light transition-all shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                        Unlock Terminal
                    </button>
                </form>
                <Link to="/" className="inline-block mt-8 text-gray-500 hover:text-white text-sm">Return to Marketplace</Link>
            </motion.div>
        </div>
    );
};

const AdminDashboard = () => {
  const [waStatus, setWaStatus] = useState({ status: 'disconnected', qr: null, user: null as any });
  const [adminNumber, setAdminNumber] = useState(localStorage.getItem('cpm_admin_number') || '');
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'wa'>('orders');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const navigate = useNavigate();

  // Redirect if not logged
  useEffect(() => {
     if (sessionStorage.getItem('is_admin') !== 'true') {
         navigate('/admin/login');
     }
  }, []);

  // Fetch Products
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
  }, []);

  // Fetch Orders
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });
  }, []);

  // WA Status
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get('/api/whatsapp/status');
        setWaStatus(res.data);
      } catch (err) {}
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // --- Product Handlers ---
  const [newProduct, setNewProduct] = useState({ name: '', price: '', imageUrl: '', description: '', category: 'Logo' as any });
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await axios.post('/api/upload', formData);
      setNewProduct({ ...newProduct, imageUrl: res.data.imageUrl });
    } catch (err) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.imageUrl) return alert('Please upload or provide an image');
    try {
      await addDoc(collection(db, 'products'), {
        ...newProduct,
        price: Number(newProduct.price),
        status: 'Available',
        createdAt: serverTimestamp()
      });
      setNewProduct({ name: '', price: '', imageUrl: '', description: '', category: 'Logo' });
      alert('Product published!');
    } catch (err) {
      alert('Failed to add product');
    }
  };

  const toggleProductStatus = async (p: Product) => {
      const next = p.status === 'Sold Out' ? 'Available' : 'Sold Out';
      await updateDoc(doc(db, 'products', p.id), { status: next });
  };

  const removeProduct = async (id: string) => {
      if (confirm('Delete this listing permanently?')) {
          await deleteDoc(doc(db, 'products', id));
      }
  };

  // --- Order Handlers ---
  const updateOrderStatus = async (id: string, status: string) => {
      try {
          await updateDoc(doc(db, 'orders', id), { status });
      } catch (err) {
          console.error("Order update failed:", err);
          alert('Failed to update status. Check permissions.');
      }
  };

  const deleteOrder = async (id: string) => {
      if (confirm('Delete this order record?')) {
          try {
              await deleteDoc(doc(db, 'orders', id));
          } catch (err) {
              console.error("Order delete failed:", err);
              alert('Failed to delete order.');
          }
      }
  };

  const handleWAAction = async (action: 'logout') => {
      if (action === 'logout') await axios.post('/api/whatsapp/logout');
  }

  const handleSaveNumber = () => {
      localStorage.setItem('cpm_admin_number', adminNumber);
      alert('Settings updated.');
  };

  return (
    <div className="pt-24 pb-20 px-4 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div>
                <h1 className="text-4xl font-serif font-bold text-luxury-gold uppercase tracking-widest">Command Center</h1>
                <p className="text-gray-500 font-medium">Control the marketplace, orders, and connectivity</p>
            </div>
            <button 
                onClick={() => { sessionStorage.clear(); navigate('/admin/login'); }}
                className="flex items-center gap-2 text-red-500 hover:text-red-400 font-bold text-sm bg-red-500/10 px-4 py-2 rounded-lg"
            >
                <LogOut size={16} /> Logout
            </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-8 bg-luxury-dark p-1.5 rounded-2xl border border-gray-800">
            {[
                { id: 'orders', label: 'Orders', icon: Package },
                { id: 'products', label: 'Inventory', icon: ImageIcon },
                { id: 'wa', label: 'WhatsApp', icon: MessageCircle }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all ${activeTab === tab.id ? 'bg-luxury-gold text-luxury-black shadow-lg shadow-luxury-gold/20' : 'text-gray-500 hover:text-white'}`}
                >
                    <tab.icon size={18} />
                    {tab.label}
                </button>
            ))}
        </div>

        <AnimatePresence mode="wait">
            {activeTab === 'orders' && (
                <motion.div key="orders" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                        {orders.length === 0 && (
                            <div className="text-center py-20 bg-luxury-dark border border-dashed border-gray-800 rounded-3xl">
                                <Package className="mx-auto text-gray-700 w-12 h-12 mb-4" />
                                <p className="text-gray-500">Wait for your first customer...</p>
                            </div>
                        )}
                        {orders.map(order => (
                            <div key={order.id} className="bg-luxury-dark border border-gray-800 p-6 rounded-3xl hover:border-luxury-gold/30 transition-colors">
                                <div className="flex flex-col lg:flex-row justify-between gap-6">
                                    <div className="space-y-4 flex-1">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-luxury-gold/10 rounded-full flex items-center justify-center text-luxury-gold">
                                              <Car size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg">{order.productName}</h4>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                                   <Clock size={12}/> {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : 'Just now'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-luxury-black/50 p-4 rounded-2xl border border-gray-800/50">
                                            <div>
                                                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Customer</p>
                                                <p className="font-medium">{order.customerName}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">WhatsApp</p>
                                                <a href={`https://wa.me/${order.customerPhone}`} target="_blank" className="text-luxury-gold hover:underline font-mono">+{order.customerPhone}</a>
                                            </div>
                                            <div className="md:col-span-2">
                                                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Delivery ID/Info</p>
                                                <p className="text-sm font-light text-gray-300">{order.address}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-between items-end gap-4 min-w-[200px]">
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Amount</p>
                                            <p className="text-3xl font-mono text-luxury-gold font-bold">₹{order.totalAmount}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 justify-end">
                                            <select 
                                                value={order.status}
                                                onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold focus:outline-none border border-gray-800 transition-colors ${
                                                    order.status === 'Delivered' ? 'bg-green-500/20 text-green-500 border-green-500/30' :
                                                    order.status === 'Cancelled' ? 'bg-red-500/20 text-red-500 border-red-500/30' :
                                                    order.status === 'Confirmed' ? 'bg-blue-500/20 text-blue-500 border-blue-500/30' :
                                                    'bg-orange-500/20 text-orange-500 border-orange-500/30'
                                                }`}
                                            >
                                                <option value="Ordered">Ordered</option>
                                                <option value="Confirmed">Confirmed</option>
                                                <option value="Shipped">Shipped</option>
                                                <option value="Delivered">Delivered</option>
                                                <option value="Cancelled">Cancelled</option>
                                            </select>
                                            <button 
                                              onClick={() => deleteOrder(order.id)}
                                              className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                                            >
                                              <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {activeTab === 'products' && (
                <motion.div key="products" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-10">
                    <div className="bg-luxury-dark border border-gray-800 p-8 rounded-3xl">
                        <h2 className="text-2xl font-serif mb-8 flex items-center gap-2">
                             <Plus className="text-luxury-gold" /> Add New Inventory
                        </h2>
                        <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                              <label className="block text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Product Title</label>
                              <input required className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-3" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Price (INR)</label>
                                <input required type="number" className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-3" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Category</label>
                                <select className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-3" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value as any})}>
                                    <option value="Logo">Logo</option>
                                    <option value="Livery">Livery</option>
                                    <option value="Car">Full Car</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Creative Asset (Image)</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="relative h-20 bg-luxury-black border border-dashed border-gray-800 rounded-xl flex items-center justify-center group pointer-events-auto">
                                        <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                        {uploading ? <RefreshCw className="animate-spin text-luxury-gold" /> : <div className="text-center"><ImageIcon className="mx-auto text-gray-600 mb-1" size={20} /><span className="text-[10px] text-gray-500">Upload Image</span></div>}
                                    </div>
                                    <input className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-3" placeholder="Or Paste URL..." value={newProduct.imageUrl} onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})} />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Description</label>
                                <textarea required rows={3} className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-3" placeholder="Tell customers about this item..." value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
                            </div>
                            <button className="md:col-span-2 bg-luxury-gold text-luxury-black py-4 rounded-xl font-bold hover:bg-gold-light transition-all flex items-center justify-center gap-2">
                                <Plus size={20} /> Publish to Marketplace
                            </button>
                        </form>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xl font-serif text-luxury-gold italic">Active Listings</h3>
                        <div className="grid grid-cols-1 gap-3">
                            {products.map(p => (
                                <div key={p.id} className="bg-luxury-dark border border-gray-800 p-3 rounded-2xl flex items-center gap-4 group">
                                    <img src={p.imageUrl} className="w-16 h-16 object-cover rounded-xl" />
                                    <div className="flex-1">
                                        <h4 className="font-bold text-sm">{p.name}</h4>
                                        <p className="text-[10px] text-luxury-gold font-mono">₹{p.price} • {p.category}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => toggleProductStatus(p)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${p.status === 'Sold Out' ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}
                                        >
                                            <Tag size={14} /> {p.status || 'Available'}
                                        </button>
                                        <button onClick={() => removeProduct(p.id)} className="p-2 text-gray-600 hover:text-red-500 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}

            {activeTab === 'wa' && (
                <motion.div key="wa" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                     <div className="bg-luxury-dark border border-gray-800 p-8 rounded-3xl">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-serif flex items-center gap-3">
                                <MessageCircle className="text-luxury-gold" /> WhatsApp Bridge
                            </h2>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${waStatus.status === 'connected' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                                {waStatus.status}
                            </span>
                        </div>

                        {waStatus.status === 'connected' ? (
                            <div className="text-center py-10 bg-luxury-black/30 rounded-3xl border border-gray-800/50">
                                <div className="w-20 h-20 bg-luxury-gold/20 text-luxury-gold rounded-full flex items-center justify-center mx-auto mb-6 border border-luxury-gold/50">
                                    <ShieldCheck size={36} />
                                </div>
                                <h3 className="text-2xl font-bold mb-2">Bridge Active</h3>
                                {waStatus.user && <p className="text-luxury-gold font-mono text-sm mb-6">Linked: {waStatus.user.id.split(':')[0]}</p>}
                                <button onClick={() => handleWAAction('logout')} className="text-red-500 border border-red-500/30 px-8 py-3 rounded-xl hover:bg-red-500 hover:text-white transition-all font-bold text-sm">
                                    Disconnect WhatsApp
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-10">
                                {waStatus.qr ? (
                                    <div className="space-y-8">
                                        <div className="relative inline-block">
                                            <div className="absolute inset-0 bg-luxury-gold/10 blur-2xl rounded-full" />
                                            <img src={waStatus.qr} className="relative mx-auto bg-white p-4 rounded-3xl w-64 h-64 shadow-2xl border-4 border-luxury-gold" />
                                        </div>
                                        <div className="space-y-4">
                                            <p className="text-gray-400 max-w-sm mx-auto">Scan this code with Linked Devices in your WhatsApp mobile app to start receiving order alerts.</p>
                                            <div className="flex items-center justify-center gap-2 text-luxury-gold">
                                                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }} className="w-2.5 h-2.5 bg-luxury-gold rounded-full" />
                                                <span className="text-xs font-black uppercase tracking-[0.2em]">Live Signal Processing</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-20 flex flex-col items-center gap-4">
                                        <RefreshCw size={40} className="animate-spin text-gray-700" />
                                        <p className="text-gray-500 font-medium">Powering up WhatsApp protocols...</p>
                                    </div>
                                )}
                            </div>
                        )}
                     </div>

                     <div className="bg-luxury-dark border border-gray-800 p-8 rounded-3xl">
                        <h2 className="text-xl font-serif mb-6 text-luxury-gold">Notification Logistics</h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Target Admin Mobile</label>
                                <div className="flex gap-4">
                                    <input className="flex-1 bg-luxury-black border border-gray-800 rounded-xl px-4 py-4 text-xl font-mono focus:border-luxury-gold focus:outline-none" placeholder="919876543210" value={adminNumber} onChange={e => setAdminNumber(e.target.value)} />
                                    <button onClick={handleSaveNumber} className="bg-white text-black px-10 rounded-xl font-bold hover:bg-luxury-gold transition-colors">UPDATE</button>
                                </div>
                                <p className="text-[10px] text-gray-600 mt-4 font-bold uppercase tracking-tight italic">Enter digit string with country code (91) | No symbols</p>
                            </div>
                        </div>
                     </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
};

// --- Root App ---

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-luxury-black selection:bg-luxury-gold selection:text-luxury-black">
        <Navbar />
        <main className="min-h-[calc(100vh-160px)]">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="border-t border-gray-900 bg-luxury-black py-16 px-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex flex-col items-center md:items-start gap-4">
              <div className="flex items-center gap-3">
                <Car className="text-luxury-gold" size={32} />
                <span className="font-serif italic text-3xl font-bold tracking-tighter text-luxury-gold">CPM Luxury</span>
              </div>
              <p className="text-gray-500 text-sm max-w-xs text-center md:text-left leading-relaxed">
                The premier digital destination for elite Car Parking Multiplayer designs. Exotic liveries and legendary logos.
              </p>
            </div>
            <div className="flex gap-8 text-gray-500 font-bold text-xs uppercase tracking-widest">
                <Link to="/" className="hover:text-luxury-gold transition-colors">Market</Link>
                <Link to="/admin/login" className="hover:text-luxury-gold transition-colors">Terminal</Link>
                <a href="#" className="hover:text-luxury-gold transition-colors">Privacy</a>
            </div>
          </div>
          <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-gray-900/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-600 text-[10px] uppercase tracking-widest">© 2026 CPM Luxury Global. All rights reserved.</p>
            <div className="flex items-center gap-2 text-gray-600 text-[10px] font-bold">
                 PROTECTED BY BLOCKCHAIN VOUCHER <ShieldCheck size={12}/>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
