require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
if (!process.env.JWT_SECRET) {
    console.warn('JWT_SECRET is not set. A temporary development secret was generated for this server session.');
}

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB successfully'))
    .catch((err) => console.error('MongoDB connection error:', err));

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, required: true },
});
const Product = mongoose.model('Product', ProductSchema);

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    salt: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true });
const User = mongoose.model('User', UserSchema);

const CartItemSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1, min: 1 },
}, { timestamps: true });
CartItemSchema.index({ userId: 1, productId: 1 }, { unique: true });
const CartItem = mongoose.model('CartItem', CartItemSchema);

const base64Url = (input) => Buffer.from(input).toString('base64url');

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
    const passwordHash = crypto
        .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
        .toString('hex');
    return { passwordHash, salt };
};

const verifyPassword = (password, user) => {
    const { passwordHash } = hashPassword(password, user.salt);
    return crypto.timingSafeEqual(Buffer.from(passwordHash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
};

const signJwt = (payload) => {
    const header = { alg: 'HS256', typ: 'JWT' };
    const tokenPayload = {
        ...payload,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
    };
    const body = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(tokenPayload))}`;
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
    return `${body}.${signature}`;
};

const verifyJwt = (token) => {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;

    const expectedSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
};

const safeUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
});

const authRequired = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ message: 'Authentication required' });

        const payload = verifyJwt(token);
        if (!payload) return res.status(401).json({ message: 'Invalid or expired token' });

        const user = await User.findById(payload.sub);
        if (!user) return res.status(401).json({ message: 'User no longer exists' });

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid authentication token' });
    }
};

const adminRequired = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

const asyncRoute = (handler) => async (req, res, next) => {
    try {
        await handler(req, res, next);
    } catch (error) {
        next(error);
    }
};

app.post('/api/auth/register', asyncRoute(async (req, res) => {
    const { name, email, password } = req.body;
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const requestedRole = req.body.signUpAsAdmin || req.body.role === 'admin' ? 'admin' : 'user';

    if (cleanName.length < 2) {
        return res.status(400).json({ message: 'Name must be at least 2 characters' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ message: 'Enter a valid email address' });
    }
    if (String(password || '').length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
        return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const { passwordHash, salt } = hashPassword(password);
    const user = await User.create({
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        salt,
        role: requestedRole,
    });
    const token = signJwt({ sub: user._id.toString(), role: user.role });

    res.status(201).json({ user: safeUser(user), token });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const cleanEmail = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email: cleanEmail });

    if (!user || !verifyPassword(password, user)) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signJwt({ sub: user._id.toString(), role: user.role });
    res.json({ user: safeUser(user), token });
}));

app.get('/api/auth/me', authRequired, (req, res) => {
    res.json({ user: safeUser(req.user) });
});

app.get('/api/products', asyncRoute(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const filter = q ? { name: { $regex: q, $options: 'i' } } : {};
    const products = await Product.find(filter).sort({ name: 1 });
    res.json(products);
}));

app.get('/api/cart', authRequired, asyncRoute(async (req, res) => {
    const cart = await CartItem.find({ userId: req.user._id }).populate('productId').sort({ createdAt: 1 });
    res.json(cart);
}));

app.post('/api/cart', authRequired, asyncRoute(async (req, res) => {
    const { productId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid product id' });
    }

    const product = await Product.findById(productId);
    if (!product) {
        return res.status(404).json({ message: 'Product not found' });
    }

    const item = await CartItem.findOneAndUpdate(
        { userId: req.user._id, productId },
        { $inc: { quantity: 1 } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    ).populate('productId');

    res.status(201).json(item);
}));

app.put('/api/cart/:id', authRequired, asyncRoute(async (req, res) => {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity)) {
        return res.status(400).json({ message: 'Quantity must be a whole number' });
    }
    if (quantity < 1) {
        await CartItem.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        return res.json({ message: 'Item deleted' });
    }

    const item = await CartItem.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        { quantity },
        { returnDocument: 'after' }
    ).populate('productId');

    if (!item) return res.status(404).json({ message: 'Cart item not found' });
    res.json(item);
}));

app.delete('/api/cart/:id', authRequired, asyncRoute(async (req, res) => {
    const item = await CartItem.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!item) return res.status(404).json({ message: 'Cart item not found' });
    res.json({ message: 'Item deleted' });
}));

app.get('/api/admin/users/carts', authRequired, adminRequired, asyncRoute(async (req, res) => {
    const users = await User.find().sort({ createdAt: 1 });
    const carts = await CartItem.find().populate('productId').sort({ createdAt: 1 });

    const cartByUser = users.map((user) => {
        const items = carts.filter((item) => item.userId && String(item.userId) === String(user._id));
        const total = items.reduce((sum, item) => sum + (item.productId?.price || 0) * item.quantity, 0);
        return {
            user: safeUser(user),
            items,
            total,
        };
    });

    res.json(cartByUser);
}));

app.use((err, req, res, next) => {
    console.error(err);
    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
