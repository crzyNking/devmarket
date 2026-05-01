// src/components/Admin/ContentModeration.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { ConfirmDialog } from '../Common/ConfirmDialog';

export function ContentModeration() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [action, setAction] = useState(null);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    try {
      // Load reported content (you'll need to create a reports table)
      const { data } = await supabase
        .from('content_reports')
        .select('*')
        .order('created_at', { ascending: false });

      setReports(data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
    }
    setLoading(false);
  }

  async function handleModerate(contentId, contentType, actionType) {
    try {
      if (actionType === 'remove') {
        const table = contentType === 'listing' ? 'listings' : 
                     contentType === 'app' ? 'apps' : 'code_snippets';
        
        await supabase.from(table).delete().eq('id', contentId);
      }
      
      // Update report status
      await supabase
        .from('content_reports')
        .update({ 
          status: actionType === 'remove' ? 'removed' : 'dismissed',
          resolved_at: new Date().toISOString()
        })
        .eq('content_id', contentId)
        .eq('content_type', contentType);

      loadReports();
    } catch (error) {
      console.error('Error moderating content:', error);
    }
    setShowConfirm(false);
  }

  return (
    <div className="content-moderation">
      <h2>Content Moderation</h2>
      
      <div className="moderation-stats">
        <div className="mod-stat">
          <h3>{reports.filter(r => r.status === 'pending').length}</h3>
          <p>Pending</p>
        </div>
        <div className="mod-stat">
          <h3>{reports.filter(r => r.status === 'removed').length}</h3>
          <p>Removed</p>
        </div>
        <div className="mod-stat">
          <h3>{reports.filter(r => r.status === 'dismissed').length}</h3>
          <p>Dismissed</p>
        </div>
      </div>

      <div className="reports-list">
        {reports.length === 0 ? (
          <div className="empty-state">
            <span>✅</span>
            <h3>No Reports</h3>
            <p>All content is clean!</p>
          </div>
        ) : (
          reports.map(report => (
            <div key={report.id} className={`report-item ${report.status}`}>
              <div className="report-header">
                <span className="report-type">{report.content_type}</span>
                <span className={`report-status ${report.status}`}>{report.status}</span>
              </div>
              <p className="report-reason">{report.reason}</p>
              <small>{new Date(report.created_at).toLocaleString()}</small>
              
              {report.status === 'pending' && (
                <div className="report-actions">
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setSelectedReport(report);
                      setAction('dismiss');
                      setShowConfirm(true);
                    }}
                  >
                    Dismiss
                  </button>
                  <button
                    className="btn-primary btn-sm"
                    style={{ background: 'var(--danger)' }}
                    onClick={() => {
                      setSelectedReport(report);
                      setAction('remove');
                      setShowConfirm(true);
                    }}
                  >
                    Remove Content
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        title={action === 'remove' ? 'Remove Content' : 'Dismiss Report'}
        message={
          action === 'remove' 
            ? 'Are you sure you want to remove this content? This action cannot be undone.'
            : 'Are you sure you want to dismiss this report?'
        }
        onConfirm={() => handleModerate(selectedReport?.content_id, selectedReport?.content_type, action)}
        onCancel={() => setShowConfirm(false)}
        confirmText={action === 'remove' ? 'Remove' : 'Dismiss'}
        type={action === 'remove' ? 'danger' : 'info'}
      />
    </div>
  );
}