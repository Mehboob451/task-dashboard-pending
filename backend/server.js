import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ============= TASKS API =============
let tasks = []; // In-memory for now, will connect to Firebase

// GET all tasks
app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

// POST new task
app.post('/api/tasks', (req, res) => {
  const { title, description, dueDate, status } = req.body;
  const newTask = {
    id: Date.now(),
    title,
    description,
    dueDate,
    status: status || 'new',
    createdAt: new Date()
  };
  tasks.push(newTask);
  res.json(newTask);
});

// UPDATE task
app.put('/api/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id == req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  
  Object.assign(task, req.body);
  res.json(task);
});

// DELETE task
app.delete('/api/tasks/:id', (req, res) => {
  tasks = tasks.filter(t => t.id != req.params.id);
  res.json({ success: true });
});

// ============= HEALTH CHECK =============
app.get('/health', (req, res) => {
  res.json({ status: 'Server running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
