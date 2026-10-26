const Book = require("../models/Book");

// Create a new book
exports.createBook = async (data) => {
    try {
        const book = new Book({
            userid: data.userId,
            title: data.title,
            author: data.author,
            subtitle: data.subtitle || "",
            chepters: (data.chapters || []).map((chapter) => ({
                title: chapter.title,
                description: chapter.description || "",
                content: chapter.content || "",
            })),
        });
        await book.save();
        return book;
    } catch (error) {
        throw new Error(`Error creating book: ${error.message}`);
    }
};

// Get all books for a user
exports.getBooks = async (filter) => {
    try {
        const books = await Book.find({ userid: filter.userId }).sort({ createdAt: -1 });
        return books;
    } catch (error) {
        throw new Error(`Error fetching books: ${error.message}`);
    }
};

// Get a single book by ID
exports.getBookById = async (bookId) => {
    try {
        const book = await Book.findById(bookId);
        return book;
    } catch (error) {
        throw new Error(`Error fetching book: ${error.message}`);
    }
};

// Update a book by ID
exports.updateBook = async (bookId, data) => {
    try {
        // Only these fields can be changed by the client. Owner and cover image
        // are never taken from the request body (cover has its own upload route).
        const allowedFields = ["title", "subtitle", "author", "status"];
        const updateData = {};
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updateData[field] = data[field];
            }
        }
        if (Array.isArray(data.chapters)) {
            updateData.chepters = data.chapters.map((chapter) => ({
                title: chapter.title,
                description: chapter.description || "",
                content: chapter.content || "",
            }));
        }
        const book = await Book.findByIdAndUpdate(bookId, updateData, {
            new: true,
            runValidators: true,
        });
        return book;
    } catch (error) {
        throw new Error(`Error updating book: ${error.message}`);
    }
};

// Delete a book by ID
exports.deleteBook = async (bookId) => {
    try {
        const book = await Book.findByIdAndDelete(bookId);
        return book;
    } catch (error) {
        throw new Error(`Error deleting book: ${error.message}`);
    }
};

// Update book cover image
exports.updateBookCover = async (bookId, coverImagePath) => {
    try {
        const book = await Book.findByIdAndUpdate(
            bookId,
            { coverimage: coverImagePath },
            { new: true }
        );
        return book;
    } catch (error) {
        throw new Error(`Error updating book cover: ${error.message}`);
    }
};
