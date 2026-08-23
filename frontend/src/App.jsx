import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = 'https://task-dashboard-pending-production-c2d8.up.railway.app'

export default function App() {
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [dueDate, setDueDate] = useState('')

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/tasks`)
      setTasks(res.data)
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const addTask = async () => {
    if (!newTask.trim()) return
    try {
      const res = await axios.post(`${API_URL}/api/tasks`, {
        title: newTask,
        dueDate,
        status: 'new'
      })
      setTasks([...tasks, res.data])
      setNewTask('')
      setDueDate('')
    } catch (error) {
      console.error('Error adding task:', error)
    }
  }

  const deleteTask = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/tasks/${id}`)
      setTasks(tasks.filter(t => t.id !== id))
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const updateTaskStatus = async (id, status) => {
    try {
      const res = await axios.put(`${API_URL}/api/tasks/${id}`, { status })
      setTasks(tasks.map(t => t.id === id ? res.data : t))
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">📋 Task Dashboard</h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Add New Task</h2>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Task name..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && addTask()}
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addTask}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-bold"
            >
              Add Task
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">Pending Tasks</h2>
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-lg">No tasks yet. Add one above!</p>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800">{task.title}</h3>
                  <p className="text-sm text-gray-500">Due: {task.dueDate || 'No date'}</p>
                  <span className={`inline-block mt-2 px-3 py-1 rounded text-sm font-bold ${
                    task.status === 'completed' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'
                  }`}>
                    {task.status}
                  </span>
                </div>
                <select
                  value={task.status}
                  onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded mr-4"
                >
                  <option value="new">New</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-bold"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
