// src/components/Listings/AdvancedSearch.js
import React, { useState } from 'react';

export function AdvancedSearch({ onSearch, onFilterChange }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    priceRange: 'all',
    sortBy: 'date',
    dateRange: 'all',
    condition: 'all',
    location: '',
    tags: ''
  });

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'website', label: '🌐 Websites' },
    { value: 'portfolio', label: '📁 Portfolios' },
    { value: 'ecommerce', label: '🛍️ E-Commerce' },
    { value: 'blog', label: '📝 Blogs' },
    { value: 'saas', label: '☁️ SaaS' },
    { value: 'other', label: '📦 Other' }
  ];

  const priceRanges = [
    { value: 'all', label: 'All Prices' },
    { value: 'free', label: 'Free' },
    { value: 'under50', label: 'Under $50' },
    { value: '50to200', label: '$50 - $200' },
    { value: '200to500', label: '$200 - $500' },
    { value: 'over500', label: 'Over $500' }
  ];

  const sortOptions = [
    { value: 'date', label: 'Most Recent' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'popular', label: 'Most Popular' },
    { value: 'rating', label: 'Highest Rated' }
  ];

  const handleChange = (field, value) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch?.(filters);
  };

  return (
    <div className="advanced-search">
      <form onSubmit={handleSubmit} className="advanced-search-form">
        <div className="search-main">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search listings, apps, code..."
              value={filters.search}
              onChange={(e) => handleChange('search', e.target.value)}
              className="advanced-search-input"
            />
            <button type="submit" className="btn-primary btn-sm search-submit">
              Search
            </button>
          </div>
          <button
            type="button"
            className="btn-secondary btn-sm filter-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '▲ Filters' : '▼ Filters'}
          </button>
        </div>

        {isExpanded && (
          <div className="search-filters">
            <div className="filter-row">
              <div className="filter-group">
                <label>Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Price Range</label>
                <select
                  value={filters.priceRange}
                  onChange={(e) => handleChange('priceRange', e.target.value)}
                >
                  {priceRanges.map(pr => (
                    <option key={pr.value} value={pr.value}>{pr.label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Sort By</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleChange('sortBy', e.target.value)}
                >
                  {sortOptions.map(so => (
                    <option key={so.value} value={so.value}>{so.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="filter-row">
              <div className="filter-group">
                <label>Date Posted</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => handleChange('dateRange', e.target.value)}
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Tags</label>
                <input
                  type="text"
                  placeholder="react, node.js, saas..."
                  value={filters.tags}
                  onChange={(e) => handleChange('tags', e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label>Location</label>
                <input
                  type="text"
                  placeholder="City or Country"
                  value={filters.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                />
              </div>
            </div>
            <div className="filter-actions">
              <button
                type="button"
                className="btn-text"
                onClick={() => {
                  const resetFilters = {
                    search: '',
                    category: 'all',
                    priceRange: 'all',
                    sortBy: 'date',
                    dateRange: 'all',
                    condition: 'all',
                    location: '',
                    tags: ''
                  };
                  setFilters(resetFilters);
                  onFilterChange?.(resetFilters);
                }}
              >
                Clear All Filters
              </button>
              <button type="submit" className="btn-primary btn-sm">
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}