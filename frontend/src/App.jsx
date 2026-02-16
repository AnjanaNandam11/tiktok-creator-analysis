import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import CreatorDetail from './pages/CreatorDetail'
import Compare from './pages/Compare'

function App() {
  const linkClass = ({ isActive }) =>
    `transition-colors ${isActive ? 'text-pink-400 font-medium' : 'text-gray-300 hover:text-pink-400'}`

  return (
    <Router>
      <div className="min-h-screen bg-gray-950 text-white">
        <nav className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <NavLink to="/" className="flex items-center gap-2 text-xl font-bold text-pink-500 hover:text-pink-400 transition-colors">
              <img src="/tiktok.svg" alt="TikTok" className="w-7 h-7" />
              TikTok Analyzer
            </NavLink>
            <div className="flex gap-6 text-sm">
              <NavLink to="/" end className={linkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/compare" className={linkClass}>
                Compare
              </NavLink>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/creator/:id" element={<CreatorDetail />} />
            <Route path="/compare" element={<Compare />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
