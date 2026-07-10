// api/hello.js
module.exports = (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
        message: 'Hello World!',
        timestamp: new Date().toISOString()
    });
};
