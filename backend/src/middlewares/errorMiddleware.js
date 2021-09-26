module.exports = (error, req, res) => {
    console.error(`ERROR MIDDLEWARE`);
    console.error(error.message);
    console.error(error.response ? error.response.data : error);
    res.status(500).json(error.response ? error.response.data : error.message)
}