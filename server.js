const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 50022;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PDF表单填写与签名系统已启动: http://localhost:${PORT}`);
});
