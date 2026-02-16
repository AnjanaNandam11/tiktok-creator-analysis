import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getCreators, addCreator, deleteCreator, updateCreator } from '../api'
import { fmt } from '../utils/format'

const USERNAME_RE = /^[\w.]{1,30}$/

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" />
    </div>
  )
}

export default function Dashboard() {
  const [creators, setCreators] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [username, setUsername] = useState('')
  const [niche, setNiche] = useState('')
  const [adding, setAdding] = useState(false)
  const [addStatus, setAddStatus] = useState('')
  const [validationError, setValidationError] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [editingNiche, setEditingNiche] = useState(null)
  const [nicheInput, setNicheInput] = useState('')

  useEffect(() => {
    getCreators()
      .then(setCreators)
      .catch(() => setError('Could not load creators. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (creator) => {
    setDeleting(creator.id)
    setConfirmDelete(null)
    setError(null)
    setSuccess(null)
    try {
      const result = await deleteCreator(creator.id)
      setCreators((prev) => prev.filter((c) => c.id !== creator.id))
      setSuccess(result.message)
    } catch {
      setError(`Failed to delete @${creator.username}. Please try again.`)
    } finally {
      setDeleting(null)
    }
  }

  const startEditNiche = (creator) => {
    setEditingNiche(creator.id)
    setNicheInput(creator.niche || '')
  }

  const saveNiche = async (creatorId) => {
    try {
      await updateCreator(creatorId, nicheInput.trim())
      setCreators((prev) =>
        prev.map((c) => (c.id === creatorId ? { ...c, niche: nicheInput.trim() } : c))
      )
    } catch {
      setError('Failed to update niche.')
    }
    setEditingNiche(null)
  }

  const handleUsernameChange = (e) => {
    const val = e.target.value
    setUsername(val)
    setValidationError('')
    setError(null)
    setSuccess(null)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    const clean = username.trim().replace(/^@/, '')
    if (!clean || adding) return

    if (!USERNAME_RE.test(clean)) {
      setValidationError('Only letters, numbers, underscores, and dots allowed.')
      return
    }

    setAdding(true)
    setError(null)
    setSuccess(null)
    setValidationError('')
    setAddStatus(`Scraping @${clean}... this may take a minute`)

    try {
      const result = await addCreator(clean, niche.trim())
      setUsername('')
      setNiche('')
      setSuccess(result.message)
      const updated = await getCreators()
      setCreators(updated)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 409) {
        setError(detail || `@${clean} is already being tracked.`)
      } else if (err.response?.status === 400) {
        setValidationError(detail || 'Invalid username.')
      } else {
        setError(detail || 'Failed to add creator. Please try again.')
      }
    } finally {
      setAdding(false)
      setAddStatus('')
    }
  }

  return (
    <div>
      {/* Demo disclaimer */}
      <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg px-4 py-3 mb-6 text-xs text-blue-300/80">
        <span className="font-medium">Demo Mode:</span> Using simulated engagement data based on actual creator profiles. Video metrics are generated using statistical models to demonstrate analytics capabilities.
      </div>

      {/* Hero intro */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">TikTok Creator Analysis</h1>
        <p className="text-gray-400 max-w-2xl">
          Track TikTok creators, analyze their posting patterns, compare engagement
          rates, and discover what content performs best. Add a creator below to get started.
        </p>
      </div>

      {/* Add creator form */}
      <form onSubmit={handleAdd} className="mb-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="TikTok username (e.g. zach.king)"
            value={username}
            onChange={handleUsernameChange}
            disabled={adding}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 flex-1 focus:outline-none focus:border-pink-500 transition-colors disabled:opacity-50"
          />
          <input
            type="text"
            placeholder="Niche (optional)"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            disabled={adding}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 sm:w-48 focus:outline-none focus:border-pink-500 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={adding || !username.trim()}
            className="bg-pink-600 hover:bg-pink-700 disabled:bg-gray-700 disabled:text-gray-500 px-6 py-2.5 rounded-lg font-medium transition-colors whitespace-nowrap"
          >
            {adding ? 'Scraping...' : 'Add Creator'}
          </button>
        </div>

        {/* Validation error */}
        {validationError && (
          <p className="text-red-400 text-sm mt-2">{validationError}</p>
        )}
      </form>

      {/* Scraping status */}
      {addStatus && (
        <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 mb-6">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-pink-500 border-t-transparent shrink-0" />
          <p className="text-gray-300 text-sm">{addStatus}</p>
        </div>
      )}

      {/* Success banner */}
      {success && (
        <div className="bg-green-900/30 border border-green-800 text-green-300 rounded-lg px-4 py-3 mb-6">
          {success}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && <Spinner />}

      {/* Empty state */}
      {!loading && !error && creators.length === 0 && !adding && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4 opacity-40">@</div>
          <p className="text-gray-400 text-lg mb-2">No creators tracked yet</p>
          <p className="text-gray-500">Add a TikTok username above to start analyzing.</p>
        </div>
      )}

      {/* Creator cards */}
      {!loading && creators.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-gray-300 mb-4 mt-4">
            Tracking {creators.length} creator{creators.length !== 1 ? 's' : ''}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creators.map((creator) => (
              <div
                key={creator.id}
                className={`rounded-xl p-6 transition-all relative ${
                  confirmDelete === creator.id
                    ? 'bg-red-950/40 border border-red-800/60'
                    : 'bg-gray-900 border border-gray-800 hover:border-pink-500/60 hover:bg-gray-900/80 group'
                }`}
              >
                {confirmDelete === creator.id ? (
                  <div className="flex flex-col items-center text-center py-2">
                    <p className="text-red-300 text-sm mb-1">Remove <span className="font-semibold">@{creator.username}</span>?</p>
                    <p className="text-red-400/60 text-xs mb-4">All videos and analytics data will be deleted.</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-4 py-1.5 rounded-lg text-sm border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(creator)}
                        disabled={deleting === creator.id}
                        className="px-4 py-1.5 rounded-lg text-sm bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                      >
                        {deleting === creator.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setConfirmDelete(creator.id)}
                      disabled={deleting === creator.id}
                      className="absolute top-3 right-3 text-gray-600 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-900/20 disabled:opacity-50"
                      title={`Remove @${creator.username}`}
                    >
                      {deleting === creator.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    <Link to={`/creator/${creator.id}`} className="block">
                      <div className="flex items-start justify-between pr-6">
                        <div>
                          <h3 className="text-lg font-semibold group-hover:text-pink-400 transition-colors">
                            @{creator.username}
                          </h3>
                        </div>
                        <span className="text-gray-600 group-hover:text-pink-500 transition-colors text-lg">
                          &rarr;
                        </span>
                      </div>
                    </Link>
                    {/* Editable niche */}
                    {editingNiche === creator.id ? (
                      <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          autoFocus
                          type="text"
                          value={nicheInput}
                          onChange={(e) => setNicheInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveNiche(creator.id)
                            if (e.key === 'Escape') setEditingNiche(null)
                          }}
                          className="bg-gray-800 border border-pink-500/50 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-pink-500 w-full"
                          placeholder="Enter niche..."
                        />
                        <button
                          onClick={() => saveNiche(creator.id)}
                          className="text-green-400 hover:text-green-300 text-xs font-medium shrink-0"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingNiche(null)}
                          className="text-gray-500 hover:text-gray-300 text-xs shrink-0"
                        >
                          Esc
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.preventDefault(); startEditNiche(creator) }}
                        className="text-gray-500 text-sm mt-1 hover:text-pink-400 transition-colors text-left"
                        title="Click to edit niche"
                      >
                        {creator.niche || 'No niche set'}{' '}
                        <span className="text-gray-600 text-xs">&#9998;</span>
                      </button>
                    )}
                    <Link to={`/creator/${creator.id}`} className="block">
                      <p className="text-pink-400 mt-3 text-lg font-medium">
                        {fmt(creator.follower_count || 0)} followers
                      </p>
                    </Link>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
