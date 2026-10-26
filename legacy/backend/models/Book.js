const mongoose = require('mongoose');
const cheptorSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: "",
    },
    content: {
        type: String,
        default: "",
    },
});
const bookSchema = new mongoose.Schema({
    userid : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    subtitle: {
        type: String,
        default: "",
    },
    author: {
        type: String,
        required: true,
    },
    coverimage: {
        type: String,
        default: "",
    },
    chepters: [cheptorSchema],
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft',
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

bookSchema.virtual('userId').get(function() {
    return this.userid;
}).set(function(val) {
    this.userid = val;
});

bookSchema.virtual('coverImage').get(function() {
    return this.coverimage;
}).set(function(val) {
    this.coverimage = val;
});

bookSchema.virtual('chapters').get(function() {
    return this.chepters;
}).set(function(val) {
    this.chepters = val;
});

module.exports = mongoose.model('Book', bookSchema);
