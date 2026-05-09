import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Car, Image as ImageIcon, Settings, CheckCircle2, X, Plus, LogOut, MessageCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from './lib/firebase';
import axios from 'axios';

// --- Types ---
interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  description: string;
  category: 'Logo' | 'Livery' | 'Car';
}

interface Order {
  customerName: string;
  customerPhone: string;
  address: string;
  productId: string;
  productName: string;
  totalAmount: number;
}

// --- Components ---

const Navbar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => (
  <nav className="fixed top-0 left-0 right-0 z-50 bg-luxury-black/80 backdrop-blur-md border-b border-luxury-gold/20">
    <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
        <Car className="text-luxury-gold w-8 h-8" />
        <span className="font-serif italic text-2xl font-bold tracking-tighter text-luxury-gold">CPM Luxury</span>
      </div>
      <div className="flex items-center gap-6">
        <button 
          onClick={() => setActiveTab('home')}
          className={`text-sm font-medium transition-colors ${activeTab === 'home' ? 'text-luxury-gold' : 'text-gray-400 hover:text-white'}`}
        >
          Marketplace
        </button>
        <button 
          onClick={() => setActiveTab('admin')}
          className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === 'admin' ? 'text-luxury-gold' : 'text-gray-400 hover:text-white'}`}
        >
          <Settings size={16} />
          Admin
        </button>
      </div>
    </div>
  </nav>
);

function ProductCard({ product, onBuy }: { product: Product; onBuy: (p: Product) => void }) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-luxury-dark border border-gray-800 rounded-2xl overflow-hidden hover:border-luxury-gold/50 transition-all duration-500"
    >
      <div className="relative aspect-video overflow-hidden">
        <img 
          src={product.imageUrl} 
          alt={product.name} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-3 left-3">
          <span className="px-2 py-1 bg-luxury-black/60 backdrop-blur-md text-[10px] uppercase tracking-widest font-bold border border-luxury-gold/30 rounded text-luxury-gold">
            {product.category}
          </span>
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-serif text-xl mb-1 group-hover:text-luxury-gold transition-colors">{product.name}</h3>
        <p className="text-gray-500 text-sm mb-4 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-mono text-luxury-gold font-bold">₹{product.price}</span>
          <button 
            onClick={() => onBuy(product)}
            className="bg-luxury-gold text-luxury-black px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-gold-light transition-colors"
          >
            Buy Now <ArrowRight size={14} />
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
      const orderRef = await addDoc(collection(db, 'orders'), {
        ...formData,
        productId: product.id,
        productName: product.name,
        totalAmount: product.price,
        status: 'Pending',
        createdAt: serverTimestamp()
      });

      // 2. Notify via WhatsApp
      const targetNumber = localStorage.getItem('cpm_admin_number') || '918075305103'; // Default or from local storage
      await axios.post('/api/notify-order', {
        order: { ...formData, productName: product.name, totalAmount: product.price },
        targetNumber
      });

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

// --- Main Pages ---

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

const Admin = () => {
  const [waStatus, setWaStatus] = useState({ status: 'disconnected', qr: null });
  const [adminNumber, setAdminNumber] = useState(localStorage.getItem('cpm_admin_number') || '');
  const [activeAdminTab, setActiveAdminTab] = useState<'wa' | 'products'>('wa');
  const [isLogged, setIsLogged] = useState(false);
  const [password, setPassword] = useState('');

  // Product Form State
  const [newProduct, setNewProduct] = useState({ name: '', price: '', imageUrl: '', description: '', category: 'Logo' as any });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get('/api/whatsapp/status');
        setWaStatus(res.data);
      } catch (err) {}
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      setIsLogged(true);
    } else {
      alert('Wrong password!');
    }
  };

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
        createdAt: serverTimestamp()
      });
      setNewProduct({ name: '', price: '', imageUrl: '', description: '', category: 'Logo' });
      alert('Product added!');
    } catch (err) {
      alert('Failed to add product');
    }
  };

  const handleSaveNumber = () => {
      localStorage.setItem('cpm_admin_number', adminNumber);
      alert('Admin number saved locally!');
  };

  const handleLogout = async () => {
    await axios.post('/api/whatsapp/logout');
  };

  if (!isLogged) {
    return (
      <div className="pt-40 pb-20 px-4 max-w-md mx-auto text-center">
        <div className="bg-luxury-dark border border-luxury-gold/30 p-10 rounded-3xl">
          <ShieldCheck className="mx-auto text-luxury-gold w-16 h-16 mb-6" />
          <h2 className="font-serif text-3xl mb-8">Admin Access</h2>
          <form onSubmit={handleLogin} className="space-y-6">
            <input 
              type="password"
              placeholder="Enter Password"
              className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-4 text-center text-xl tracking-[0.5em] focus:border-luxury-gold focus:outline-none"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button className="w-full bg-luxury-gold text-luxury-black py-4 rounded-xl font-bold hover:bg-gold-light transition-all">
              Unlock Terminal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 px-4 max-w-4xl mx-auto">
      <div className="flex bg-luxury-dark p-1 rounded-xl mb-10 border border-gray-800">
        <button 
          onClick={() => setActiveAdminTab('wa')}
          className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${activeAdminTab === 'wa' ? 'bg-luxury-gold text-luxury-black' : 'text-gray-500 hover:text-white'}`}
        >
          WhatsApp Setup
        </button>
        <button 
          onClick={() => setActiveAdminTab('products')}
          className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${activeAdminTab === 'products' ? 'bg-luxury-gold text-luxury-black' : 'text-gray-500 hover:text-white'}`}
        >
          Manage Products
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeAdminTab === 'wa' ? (
          <motion.div key="wa" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
            <div className="bg-luxury-dark border border-gray-800 p-8 rounded-3xl">
              <h2 className="text-2xl font-serif mb-6 flex items-center gap-3">
                <MessageCircle className="text-luxury-gold" /> WhatsApp Connection
              </h2>
              
              {waStatus.status === 'connected' ? (
                <div className="text-center py-10">
                  <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50">
                    <ShieldCheck size={40} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Connected</h3>
                  <p className="text-gray-400 mb-8">Your WhatsApp is active and ready to receive orders.</p>
                  <button onClick={handleLogout} className="text-red-500 border border-red-500/30 px-6 py-2 rounded-lg hover:bg-red-500 hover:text-white transition-all font-bold text-sm">
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  {waStatus.qr ? (
                    <div className="space-y-6">
                      <p className="text-gray-400">Scan this QR code with your WhatsApp to connect</p>
                      <img src={waStatus.qr} alt="QR" className="mx-auto bg-white p-4 rounded-3xl w-64 h-64 shadow-xl" />
                      <div className="flex items-center justify-center gap-2 text-luxury-gold">
                        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-2 h-2 bg-luxury-gold rounded-full" />
                        <span className="text-xs uppercase font-bold tracking-widest">Waiting for scan...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-luxury-gold mx-auto"></div>
                      <p className="text-gray-400">Initializing WhatsApp engine...</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-luxury-dark border border-gray-800 p-8 rounded-3xl">
              <h2 className="text-2xl font-serif mb-6 flex items-center gap-3">
                <Settings className="text-luxury-gold" /> Notification Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2 font-bold">Admin Phone Number (Receive Orders)</label>
                  <div className="flex gap-4">
                    <input 
                      className="flex-1 bg-luxury-black border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-luxury-gold transition-colors"
                      placeholder="e.g. 918075305103"
                      value={adminNumber}
                      onChange={e => setAdminNumber(e.target.value)}
                    />
                    <button onClick={handleSaveNumber} className="bg-white text-black px-6 rounded-xl font-bold hover:bg-luxury-gold transition-colors">
                      Save
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-2">Include country code without + (e.g. 91 for India)</p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="products" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="bg-luxury-dark border border-gray-800 p-8 rounded-3xl mb-10">
               <h2 className="text-2xl font-serif mb-8">Add New Item</h2>
               <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1 font-bold uppercase">Product Name</label>
                    <input 
                      required
                      className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-3"
                      value={newProduct.name}
                      onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 font-bold uppercase">Price (₹)</label>
                    <input 
                      required
                      type="number"
                      className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-3 transition-all h-[48px]"
                      value={newProduct.price}
                      onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 font-bold uppercase">Category</label>
                    <select 
                      className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-3 h-[48px]"
                      value={newProduct.category}
                      onChange={e => setNewProduct({...newProduct, category: e.target.value as any})}
                    >
                      <option value="Logo">Logo</option>
                      <option value="Livery">Livery</option>
                      <option value="Car">Full Car</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1 font-bold uppercase">Image Selection</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[10px] text-gray-600 uppercase font-black">Option 1: Local Upload</label>
                        <div className="relative group">
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          />
                          <div className="bg-luxury-black border-2 border-dashed border-gray-800 group-hover:border-luxury-gold/50 rounded-xl py-6 flex flex-col items-center gap-2 transition-all">
                            {uploading ? (
                              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-luxury-gold" />
                            ) : (
                              <>
                                <ImageIcon className="text-gray-600 group-hover:text-luxury-gold" />
                                <span className="text-xs text-gray-500 group-hover:text-white">Choose File</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] text-gray-600 uppercase font-black">Option 2: Direct URL</label>
                        <input 
                          className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-3 h-[76px]"
                          value={newProduct.imageUrl}
                          onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    {newProduct.imageUrl && (
                      <div className="mt-4 p-2 bg-luxury-black rounded-lg border border-gray-800 flex items-center gap-4">
                        <img src={newProduct.imageUrl} className="w-12 h-12 object-cover rounded" />
                        <span className="text-[10px] text-gray-500 truncate flex-1">{newProduct.imageUrl}</span>
                        <button onClick={() => setNewProduct({...newProduct, imageUrl: ''})} className="text-red-500 p-1"><X size={14}/></button>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1 font-bold uppercase">Description</label>
                    <textarea 
                      required
                      className="w-full bg-luxury-black border border-gray-800 rounded-xl px-4 py-3"
                      rows={3}
                      value={newProduct.description}
                      onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                    />
                  </div>
                  <button className="md:col-span-2 bg-luxury-gold text-luxury-black py-4 rounded-xl font-bold flex items-center justify-center gap-2">
                    <Plus size={20} /> Publish to Market
                  </button>
               </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="min-h-screen bg-luxury-black">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <AnimatePresence mode="wait">
        {activeTab === 'home' ? (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Home />
          </motion.div>
        ) : (
          <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Admin />
          </motion.div>
        )}
      </AnimatePresence>
      <footer className="border-t border-gray-900 bg-luxury-black py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50 grayscale">
            <Car size={20} />
            <span className="font-serif italic text-lg tracking-tighter">CPM Luxury Market</span>
          </div>
          <p className="text-gray-600 text-sm">© 2026 CPM Luxury. All rights reserved. Built for enthusiasts.</p>
        </div>
      </footer>
    </div>
  );
}
