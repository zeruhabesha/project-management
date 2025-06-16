import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Users, FolderOpen, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface AssignProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: any;
  user?: any;
}

const AssignProjectModal: React.FC<AssignProjectModalProps> = ({ isOpen, onClose, project, user }) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  // Mock data
  const mockUsers = [
    { id: '1', name: 'John Smith', email: 'john@company.com', role: 'manager' },
    { id: '2', name: 'Sarah Johnson', email: 'sarah@company.com', role: 'manager' },
    { id: '3', name: 'Mike Wilson', email: 'mike@company.com', role: 'user' },
    { id: '4', name: 'Emily Davis', email: 'emily@company.com', role: 'user' },
  ];

  const mockProjects = [
    { id: '1', name: 'Office Complex Construction', ref_no: 'PRJ-2024-001' },
    { id: '2', name: 'Shopping Mall Development', ref_no: 'PRJ-2024-002' },
    { id: '3', name: 'Residential Complex', ref_no: 'PRJ-2024-003' },
    { id: '4', name: 'Industrial Warehouse', ref_no: 'PRJ-2024-004' },
  ];

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleProjectToggle = (projectId: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleAssign = () => {
    if (project) {
      // Assigning users to a project
      toast.success(`Assigned ${selectedUsers.length} users to ${project.name}`);
    } else if (user) {
      // Assigning projects to a user
      toast.success(`Assigned ${selectedProjects.length} projects to ${user.name}`);
    }
    onClose();
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setSelectedProjects([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                {project ? <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" /> : <FolderOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {project ? `Assign Users to ${project.name}` : `Assign Projects to ${user?.name}`}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {project ? 'Select users to assign to this project' : 'Select projects to assign to this user'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4">
            {project ? (
              // Assigning users to project
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Available Users</h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {mockUsers.map((user) => (
                    <div
                      key={user.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedUsers.includes(user.id)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => handleUserToggle(user.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{user.email} • {user.role}</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded border-2 ${
                        selectedUsers.includes(user.id)
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-300 dark:border-gray-500'
                      }`}>
                        {selectedUsers.includes(user.id) && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Assigning projects to user
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Available Projects</h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {mockProjects.map((project) => (
                    <div
                      key={project.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedProjects.includes(project.id)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => handleProjectToggle(project.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-600 rounded-lg">
                          <FolderOpen className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{project.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{project.ref_no}</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded border-2 ${
                        selectedProjects.includes(project.id)
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-300 dark:border-gray-500'
                      }`}>
                        {selectedProjects.includes(project.id) && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Summary */}
            {(selectedUsers.length > 0 || selectedProjects.length > 0) && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {project 
                    ? `${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''} selected`
                    : `${selectedProjects.length} project${selectedProjects.length !== 1 ? 's' : ''} selected`
                  }
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-6 border-t border-gray-200 dark:border-gray-600">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 focus:ring-4 focus:ring-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={selectedUsers.length === 0 && selectedProjects.length === 0}
              className="flex-1 px-4 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Assign Selected</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AssignProjectModal;