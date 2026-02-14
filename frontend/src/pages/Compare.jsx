import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Link } from 'react-router-dom'
import { getCreators, compareCreators } from '../api'
import { fmt } from '../utils/format'

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" />
    </div>
  )
}

const COLORS = ['#ec4899', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981']

function getInsights(data) {
  if (!data || data.length < 2) return []
  const insights = []

  const topFollowers = [...data].sort((a, b) => b.follower_count - a.follower_count)[0]
  insights.push({
    icon: '👥',
    label: 'Largest Audience',
    value: `@${topFollowers.username}`,
    detail: `${fmt(topFollowers.follower_count)} followers`,
  })

  const topEngagement = [...data].sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate)[0]
  insights.push({
    icon: '🔥',
    label: 'Highest Engagement',
    value: `@${topEngagement.username}`,
    detail: `${topEngagement.avg_engagement_rate}% avg rate`,
  })

  const topViews = [...data].sort((a, b) => b.avg_views - a.avg_views)[0]
  insights.push({
    icon: '👁',
    label: 'Most Viewed',
    value: `@${topViews.username}`,
    detail: `${fmt(topViews.avg_views)} avg views`,
  })

  const topPosting = [...data].sort((a, b) => b.posting_frequency - a.posting_frequency)[0]
  if (topPosting.posting_frequency > 0) {
    insights.push({
      icon: '📅',
      label: 'Most Active',
      value: `@${topPosting.username}`,
      detail: `${topPosting.posting_frequency} posts/day`,
    })
  }

  return insights
}

export default function Compare() {
  const [creators, setCreators] = useState([])
  const [selected, setSelected] = useState([])
  const [comparisonData, setComparisonData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCreators()
      .then(setCreators)
      .catch(() => setError('Could not load creators.'))
      .finally(() => setLoading(false))
  }, [])

  const toggleCreator = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleCompare = async () => {
    if (selected.length < 2) return
    setComparing(true)
    setError(null)
    try {
      const data = await compareCreators(selected)
      setComparisonData(data)
    } catch {
      setError('Comparison failed. Please try again.')
    } finally {
      setComparing(false)
    }
  }

  if (loading) return <Spinner />

  const results = comparisonData?.creators
  const insights = results ? getInsights(results) : []

  return (
    <div>
      {/* Demo disclaimer */}
      <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg px-4 py-2.5 mb-6 text-xs text-blue-300/80">
        <span className="font-medium">Note:</span> Comparison metrics are based on simulated data for demonstration purposes.
      </div>

      <h1 className="text-3xl font-bold mb-2">Compare Creators</h1>
      <p className="text-gray-400 mb-8">Select two or more creators to see side-by-side analytics.</p>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {creators.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg mb-2">No creators to compare</p>
          <p className="text-gray-500 mb-4">Add creators from the Dashboard first.</p>
          <Link to="/" className="text-pink-400 hover:text-pink-300 transition-colors">
            &larr; Go to Dashboard
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <p className="text-gray-400 text-sm mb-3">Select creators:</p>
            <div className="flex flex-wrap gap-3">
              {creators.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleCreator(c.id)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    selected.includes(c.id)
                      ? 'border-pink-500 bg-pink-500/20 text-pink-300'
                      : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  @{c.username}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCompare}
            disabled={selected.length < 2 || comparing}
            className="bg-pink-600 hover:bg-pink-700 disabled:bg-gray-700 disabled:text-gray-500 px-6 py-2.5 rounded-lg font-medium transition-colors mb-8"
          >
            {comparing ? 'Comparing...' : `Compare (${selected.length} selected)`}
          </button>
        </>
      )}

      {results && (
        <div className="space-y-8">
          {/* 1. Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {results.map((c, i) => (
              <div
                key={c.username}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 relative overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 w-1 h-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <p className="text-sm text-gray-400 mb-1">@{c.username}</p>
                <p className="text-2xl font-bold" style={{ color: COLORS[i % COLORS.length] }}>
                  {fmt(c.follower_count)}
                </p>
                <p className="text-xs text-gray-500 mb-3">followers</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Engagement</p>
                    <p className="font-medium text-gray-200">{c.avg_engagement_rate}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Avg Views</p>
                    <p className="font-medium text-gray-200">{fmt(c.avg_views)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Videos</p>
                    <p className="font-medium text-gray-200">{c.total_videos}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Posts/Day</p>
                    <p className="font-medium text-gray-200">{c.posting_frequency}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 2. Side-by-side Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Followers chart */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4">Follower Count</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={results} barCategoryGap="30%">
                  <XAxis dataKey="username" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis tickFormatter={fmt} tick={{ fill: '#6b7280', fontSize: 12 }} width={50} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f9fafb' }}
                    formatter={(value) => [fmt(value), 'Followers']}
                  />
                  <Bar dataKey="follower_count" name="Followers" radius={[4, 4, 0, 0]}>
                    {results.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Engagement chart */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4">Engagement Rate</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={results} barCategoryGap="30%">
                  <XAxis dataKey="username" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} unit="%" width={50} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f9fafb' }}
                    formatter={(value) => [`${value}%`, 'Engagement']}
                  />
                  <Bar dataKey="avg_engagement_rate" name="Engagement %" radius={[4, 4, 0, 0]}>
                    {results.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Avg Views chart */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4">Average Views</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={results} barCategoryGap="30%">
                  <XAxis dataKey="username" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis tickFormatter={fmt} tick={{ fill: '#6b7280', fontSize: 12 }} width={50} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f9fafb' }}
                    formatter={(value) => [fmt(value), 'Avg Views']}
                  />
                  <Bar dataKey="avg_views" name="Avg Views" radius={[4, 4, 0, 0]}>
                    {results.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Avg Likes chart */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4">Average Likes</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={results} barCategoryGap="30%">
                  <XAxis dataKey="username" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis tickFormatter={fmt} tick={{ fill: '#6b7280', fontSize: 12 }} width={50} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f9fafb' }}
                    formatter={(value) => [fmt(value), 'Avg Likes']}
                  />
                  <Bar dataKey="avg_likes" name="Avg Likes" radius={[4, 4, 0, 0]}>
                    {results.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Detailed Comparison Table */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 overflow-x-auto">
            <h2 className="text-lg font-semibold mb-4">Detailed Comparison</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="text-left py-3 pr-4">Creator</th>
                  <th className="text-right py-3 px-4">Followers</th>
                  <th className="text-right py-3 px-4">Videos</th>
                  <th className="text-right py-3 px-4">Avg Views</th>
                  <th className="text-right py-3 px-4">Avg Likes</th>
                  <th className="text-right py-3 px-4">Avg Comments</th>
                  <th className="text-right py-3 px-4">Engagement</th>
                  <th className="text-right py-3 pl-4">Posts/Day</th>
                </tr>
              </thead>
              <tbody>
                {results.map((c, i) => (
                  <tr key={c.username} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 pr-4 font-medium">
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      @{c.username}
                    </td>
                    <td className="py-3 px-4 text-right">{fmt(c.follower_count)}</td>
                    <td className="py-3 px-4 text-right">{c.total_videos}</td>
                    <td className="py-3 px-4 text-right">{fmt(c.avg_views)}</td>
                    <td className="py-3 px-4 text-right">{fmt(c.avg_likes)}</td>
                    <td className="py-3 px-4 text-right">{fmt(c.avg_comments)}</td>
                    <td className="py-3 px-4 text-right text-pink-400 font-medium">{c.avg_engagement_rate}%</td>
                    <td className="py-3 pl-4 text-right">{c.posting_frequency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4. Insights Panel */}
          {insights.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4">Key Insights</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {insights.map((insight) => (
                  <div
                    key={insight.label}
                    className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{insight.icon}</span>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">{insight.label}</p>
                    </div>
                    <p className="text-base font-semibold text-white">{insight.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{insight.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
