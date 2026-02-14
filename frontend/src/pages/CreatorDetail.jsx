import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { getCreator, getCreatorStats, getCreatorPatterns, getCreatorTopVideos } from '../api'
import { fmt } from '../utils/format'

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" />
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  )
}

export default function CreatorDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [stats, setStats] = useState(null)
  const [patterns, setPatterns] = useState(null)
  const [topVideos, setTopVideos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      getCreator(id),
      getCreatorStats(id).catch(() => null),
      getCreatorPatterns(id).catch(() => null),
      getCreatorTopVideos(id).catch(() => null),
    ])
      .then(([creatorData, statsData, patternsData, topData]) => {
        if (creatorData.error) {
          setError(creatorData.error)
        } else {
          setData(creatorData)
          setStats(statsData)
          setPatterns(patternsData)
          setTopVideos(topData)
        }
      })
      .catch(() => setError('Failed to load creator data.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Spinner />

  if (error) {
    return (
      <div>
        <Link to="/" className="text-pink-400 hover:text-pink-300 transition-colors mb-4 inline-block">&larr; Back to Dashboard</Link>
        <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-4 py-3">
          {error}
        </div>
      </div>
    )
  }

  const { creator, videos } = data

  return (
    <div>
      {/* Back navigation */}
      <Link to="/" className="text-pink-400 hover:text-pink-300 transition-colors mb-6 inline-block">
        &larr; Back to Dashboard
      </Link>

      {/* Demo disclaimer */}
      <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg px-4 py-2.5 mb-6 text-xs text-blue-300/80">
        <span className="font-medium">Note:</span> Individual video metrics are simulated for demonstration purposes.
      </div>

      {/* Profile header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">@{creator.username}</h1>
        <p className="text-gray-400 mt-1">{creator.niche || 'No niche'}</p>
        <p className="text-pink-400 text-lg mt-2 font-medium">
          {(creator.follower_count || 0).toLocaleString()} followers
        </p>
      </div>

      {/* Stats cards */}
      {stats && stats.total_videos > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Videos" value={stats.total_videos} />
          <StatCard label="Total Views" value={fmt(stats.total_views)} />
          <StatCard label="Total Likes" value={fmt(stats.total_likes)} />
          <StatCard label="Avg Engagement" value={`${stats.avg_engagement_rate}%`} />
        </div>
      )}

      {/* Posting patterns */}
      {patterns && patterns.total_posts >= 5 && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-8">
          <h2 className="text-xl font-semibold mb-4">Posting Patterns</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-400 text-sm mb-2">Best Hours</p>
              {Object.entries(patterns.best_hours).map(([hour, rate]) => (
                <div key={hour} className="flex justify-between text-sm py-1">
                  <span className="text-gray-300">{String(hour).padStart(2, '0')}:00</span>
                  <span className="text-pink-400">{rate}% eng.</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-2">Best Days</p>
              {Object.entries(patterns.best_days).slice(0, 3).map(([day, rate]) => (
                <div key={day} className="flex justify-between text-sm py-1">
                  <span className="text-gray-300">{day}</span>
                  <span className="text-pink-400">{rate}% eng.</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-2">Frequency</p>
              <p className="text-2xl font-semibold">{patterns.posting_frequency}</p>
              <p className="text-gray-500 text-sm">posts per day</p>
            </div>
          </div>
        </div>
      )}

      {patterns && patterns.total_posts > 0 && patterns.total_posts < 5 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-3 mb-8 text-gray-500">
          Not enough data to show posting patterns (need at least 5 videos).
        </div>
      )}

      {/* Video performance chart */}
      <h2 className="text-xl font-semibold mb-4">Video Performance</h2>

      {videos.length > 0 ? (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-8">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={videos}>
              <XAxis dataKey="video_id" tick={false} />
              <YAxis tickFormatter={fmt} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(value) => value.toLocaleString()}
              />
              <Bar dataKey="views" fill="#ec4899" name="Views" />
              <Bar dataKey="likes" fill="#8b5cf6" name="Likes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-8 mb-8 text-center text-gray-500">
          No videos scraped yet for this creator.
        </div>
      )}

      {/* Top videos by engagement */}
      {topVideos && topVideos.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Top Videos by Engagement</h2>
          <div className="space-y-3">
            {topVideos.map((v, i) => (
              <div
                key={v.video_id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex justify-between items-center"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-gray-600 font-mono text-sm mt-0.5 shrink-0">#{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{v.caption || 'No caption'}</p>
                    <p className="text-gray-500 text-sm mt-1">
                      {v.posted_at ? new Date(v.posted_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-400 shrink-0 ml-4">
                  <p className="text-pink-400 font-medium">{v.engagement_rate}% eng.</p>
                  <p>{fmt(v.views)} views</p>
                  <p>{fmt(v.likes)} likes</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full video list */}
      {videos.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">All Videos ({videos.length})</h2>
          <div className="space-y-3">
            {videos.map((v) => (
              <div
                key={v.video_id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex justify-between items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{v.caption || 'No caption'}</p>
                  <p className="text-gray-500 text-sm mt-1">{v.hashtags}</p>
                </div>
                <div className="text-right text-sm text-gray-400 shrink-0 ml-4">
                  <p>{(v.views || 0).toLocaleString()} views</p>
                  <p>{(v.likes || 0).toLocaleString()} likes</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
