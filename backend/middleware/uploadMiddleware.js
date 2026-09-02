const multer = require("multer");
const path = require("path");
const fs = require("fs");
// create upload directory if it doesn't exist
const uploader = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploader)) {
    fs.mkdirSync(uploader, { recursive: true });
}
//set up storage engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploader);
    },
    filename: function (req, file, cb) {
        cb(
            null,
         `${file.fieldname || "cover"}-${Date.now()}${path.extname(file.originalname)}`
        );
    
    },
});
//check file type
function checkFileType(file, cb) {
    const filetypes = /jpg|jpeg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb("Error: Images Only!");
    }
}
//init upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 1000000 },
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});
module.exports = upload;