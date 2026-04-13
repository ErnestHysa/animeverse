/**
 * Admin Magnet Management Page
 * Admin panel for managing magnet links
 *
 * Features:
 * - Manual magnet entry
 * - Bulk CSV import
 * - Magnet validation dashboard
 *
 * Phase 7: Content Acquisition & Seeding
 */

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import {
  Plus,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  RefreshCw,
  Download,
  Filter,
} from "lucide-react";

interface MagnetEntry {
  id: string;
  animeId: number;
  animeTitle: string;
  episode: number;
  magnet: string;
  infoHash: string;
  quality: string;
  seeders: number;
  leechers: number;
  provider: "manual" | "nyaa" | "nyaa-land" | "anidex" | "scraper";
  status: "active" | "dead" | "pending" | "verified";
  lastChecked: number;
  createdAt: number;
  updatedAt: number;
  submittedBy?: string;
  notes?: string;
}

export default function AdminMagnetsPage() {
  const [magnets, setMagnets] = useState<MagnetEntry[]>([]);
  const [filteredMagnets, setFilteredMagnets] = useState<MagnetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<"all" | "1080p" | "720p" | "480p">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "nyaa" | "anidex">("all");

  // New magnet form
  const [newMagnet, setNewMagnet] = useState({
    animeId: "",
    animeTitle: "",
    episode: "",
    magnet: "",
    quality: "",
    notes: "",
  });

  // CSV import
  const [csvData, setCsvData] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const loadMagnets = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/admin/magnets");
        const data = await response.json();
        setMagnets(data.magnets || []);
      } catch (error) {
        console.error("Error fetching magnets:", error);
        toast.error("Failed to load magnets");
      } finally {
        setLoading(false);
      }
    };
    loadMagnets();
  }, []);

  useEffect(() => {
    filterMagnets();
  }, [magnets, statusFilter, providerFilter, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMagnets = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/magnets");
      const data = await response.json();
      setMagnets(data.magnets || []);
    } catch (error) {
      console.error("Error fetching magnets:", error);
      toast.error("Failed to load magnets");
    } finally {
      setLoading(false);
    }
  };

  const filterMagnets = () => {
    let filtered = [...magnets];

    if (statusFilter !== "all") {
      filtered = filtered.filter((m) => m.status === statusFilter);
    }

    if (providerFilter !== "all") {
      filtered = filtered.filter((m) => m.provider === providerFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.animeTitle.toLowerCase().includes(query) ||
          m.animeId.toString().includes(query) ||
          m.episode.toString().includes(query) ||
          m.infoHash.toLowerCase().includes(query)
      );
    }

    setFilteredMagnets(filtered);
  };

  const handleAddMagnet = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/admin/magnets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMagnet),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setShowAddModal(false);
        setNewMagnet({
          animeId: "",
          animeTitle: "",
          episode: "",
          magnet: "",
          quality: "",
          notes: "",
        });
        fetchMagnets();
      } else {
        toast.error(data.error || "Failed to add magnet");
      }
    } catch (error) {
      console.error("Error adding magnet:", error);
      toast.error("Failed to add magnet");
    }
  };

  const handleBulkImport = async () => {
    if (!csvData.trim()) {
      toast.error("Please enter CSV data");
      return;
    }

    try {
      setImporting(true);
      const response = await fetch("/api/admin/magnets/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "csv", data: csvData }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setShowImportModal(false);
        setCsvData("");
        fetchMagnets();
      } else {
        toast.error(data.error || "Failed to import magnets");
      }
    } catch (error) {
      console.error("Error importing magnets:", error);
      toast.error("Failed to import magnets");
    } finally {
      setImporting(false);
    }
  };

  const handleValidateMagnet = async (id: string) => {
    try {
      const response = await fetch("/api/admin/magnets/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        fetchMagnets();
      } else {
        toast.error(data.error || "Failed to validate magnet");
      }
    } catch (error) {
      console.error("Error validating magnet:", error);
      toast.error("Failed to validate magnet");
    }
  };

  const handleDeleteMagnet = async (id: string) => {
    if (!confirm("Are you sure you want to delete this magnet link?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/magnets?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        fetchMagnets();
      } else {
        toast.error(data.error || "Failed to delete magnet");
      }
    } catch (error) {
      console.error("Error deleting magnet:", error);
      toast.error("Failed to delete magnet");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: "bg-green-500/20 text-green-400", icon: CheckCircle },
      dead: { color: "bg-red-500/20 text-red-400", icon: XCircle },
      pending: { color: "bg-yellow-500/20 text-yellow-400", icon: Clock },
      verified: { color: "bg-blue-500/20 text-blue-400", icon: CheckCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config?.icon || Clock;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config?.color}`}
      >
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  const exportToCSV = () => {
    const headers = ["animeId", "animeTitle", "episode", "magnet", "quality", "notes"];
    const csv = [
      headers.join(","),
      ...magnets.map((m) =>
        [
          m.animeId,
          `"${m.animeTitle}"`,
          m.episode,
          `"${m.magnet}"`,
          m.quality,
          m.notes ? `"${m.notes}"` : "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `magnets-export-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Magnet Management
          </h1>
          <p className="text-gray-400">
            Manage and validate magnet links for anime streaming
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700"
          >
            <div className="text-2xl font-bold text-white">{magnets.length}</div>
            <div className="text-sm text-gray-400">Total Magnets</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700"
          >
            <div className="text-2xl font-bold text-green-400">
              {magnets.filter((m) => m.status === "active").length}
            </div>
            <div className="text-sm text-gray-400">Active</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700"
          >
            <div className="text-2xl font-bold text-yellow-400">
              {magnets.filter((m) => m.status === "pending").length}
            </div>
            <div className="text-sm text-gray-400">Pending</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700"
          >
            <div className="text-2xl font-bold text-red-400">
              {magnets.filter((m) => m.status === "dead").length}
            </div>
            <div className="text-sm text-gray-400">Dead</div>
          </motion.div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 mb-6">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Magnet
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            Bulk Import
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button
            onClick={fetchMagnets}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="dead">Dead</option>
              <option value="verified">Verified</option>
            </select>

            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Providers</option>
              <option value="manual">Manual</option>
              <option value="nyaa">Nyaa</option>
              <option value="nyaa-land">Nyaa Land</option>
              <option value="anidex">AniDex</option>
              <option value="scraper">Scraper</option>
            </select>
          </div>
        </div>

        {/* Magnets List */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Anime
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Episode
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Quality
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Seeders
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Provider
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Last Checked
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      Loading magnets...
                    </td>
                  </tr>
                ) : filteredMagnets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      No magnets found
                    </td>
                  </tr>
                ) : (
                  filteredMagnets.map((magnet) => (
                    <tr key={magnet.id} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">
                          {magnet.animeTitle}
                        </div>
                        <div className="text-gray-400 text-sm">
                          ID: {magnet.animeId}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white">{magnet.episode}</td>
                      <td className="px-4 py-3 text-white">{magnet.quality}</td>
                      <td className="px-4 py-3">
                        {getStatusBadge(magnet.status)}
                      </td>
                      <td className="px-4 py-3 text-white">
                        {magnet.seeders} / {magnet.leechers}
                      </td>
                      <td className="px-4 py-3 text-white">{magnet.provider}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {new Date(magnet.lastChecked).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleValidateMagnet(magnet.id)}
                            className="p-1 hover:bg-gray-700 rounded transition-colors"
                            title="Validate"
                          >
                            <RefreshCw className="w-4 h-4 text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteMagnet(magnet.id)}
                            className="p-1 hover:bg-gray-700 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Magnet Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-4">Add Magnet Link</h2>

              <form onSubmit={handleAddMagnet} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Anime ID *
                  </label>
                  <input
                    type="number"
                    required
                    value={newMagnet.animeId}
                    onChange={(e) =>
                      setNewMagnet({ ...newMagnet, animeId: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Anime Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newMagnet.animeTitle}
                    onChange={(e) =>
                      setNewMagnet({ ...newMagnet, animeTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Episode *
                  </label>
                  <input
                    type="number"
                    required
                    value={newMagnet.episode}
                    onChange={(e) =>
                      setNewMagnet({ ...newMagnet, episode: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Magnet Link *
                  </label>
                  <input
                    type="text"
                    required
                    value={newMagnet.magnet}
                    onChange={(e) =>
                      setNewMagnet({ ...newMagnet, magnet: e.target.value })
                    }
                    placeholder="magnet:?xt=urn:btih:..."
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Quality
                  </label>
                  <select
                    value={newMagnet.quality}
                    onChange={(e) =>
                      setNewMagnet({ ...newMagnet, quality: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Unknown</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                    <option value="360p">360p</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={newMagnet.notes}
                    onChange={(e) =>
                      setNewMagnet({ ...newMagnet, notes: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  >
                    Add Magnet
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bulk Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-4">Bulk Import</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    CSV Data
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Format: animeId,animeTitle,episode,magnet,quality,notes
                  </p>
                  <textarea
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    rows={10}
                    placeholder="1234,&quot;My Anime Title&quot;,1,&quot;magnet:?xt=urn:btih:...&quot;,1080p,&quot;Great quality&quot;"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkImport}
                    disabled={importing}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {importing ? "Importing..." : "Import"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
