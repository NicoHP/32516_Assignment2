require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');

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

const sampleProducts = [
    {
        name: 'Wireless Headphones',
        price: 299.99,
        image: '/images/headphone.png'
    },
    {
        name: 'Mechanical Keyboard',
        price: 129.99,
        image: '/images/keyboard.png'
    },
    {
        name: 'Mouse',
        price: 79.99,
        image: '/images/mouse.png'
    },
    {
        name: '27-inch 4K Monitor',
        price: 449.99,
        image: '/images/monitor.png'
    }
];

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
    const passwordHash = crypto
        .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
        .toString('hex');
    return { passwordHash, salt };
};

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for seeding...');

        await Product.deleteMany({});
        await CartItem.deleteMany({});
        console.log('Old products and carts cleared.');

        await Product.insertMany(sampleProducts);
        console.log('Test products added successfully.');

        if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
            const { passwordHash, salt } = hashPassword(process.env.ADMIN_PASSWORD);
            await User.findOneAndUpdate(
                { email: process.env.ADMIN_EMAIL.toLowerCase() },
                {
                    name: process.env.ADMIN_NAME || 'Store Admin',
                    email: process.env.ADMIN_EMAIL.toLowerCase(),
                    passwordHash,
                    salt,
                    role: 'admin',
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            console.log('Admin account seeded from environment variables.');
        }

        mongoose.connection.close();
        console.log('Database connection closed.');
    } catch (error) {
        console.error('Error seeding the database:', error);
        mongoose.connection.close();
    }
};

seedDB();
