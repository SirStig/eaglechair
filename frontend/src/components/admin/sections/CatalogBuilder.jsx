import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Copy, FilePlus2, Loader2, Sparkles, Trash2 } from 'lucide-react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';
import {
  createProject, createSampleProject, deleteProject, duplicateProject, getProject, listProjects,
} from '../../../services/catalogToolsService';
import CatalogBuilderEditor from './catalogBuilder/CatalogBuilderEditor';
import { newPage } from './catalogBuilder/pageModel';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import DeleteGate from '../DeleteGate';

const formatDate = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/**
 * Catalog Builder - saved catalog projects. Each opens in the editor, which
 * lays pages out in the Eagle Chair catalog design and exports the PDF.
 */
const CatalogBuilder = () => {
  const toast = useToast();
  const toastError = toast.error; // stable (the toast object itself is not)
  const { refreshKeys } = useAdminRefresh();
  const refreshKey = refreshKeys['catalog-builder'];
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [opening, setOpening] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [buildingSample, setBuildingSample] = useState(false);

  const load = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch (error) {
      toastError(error?.response?.data?.detail || 'Failed to load catalogs');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  // Clicking the sidebar entry again returns to the list
  useEffect(() => {
    setOpen(null);
    load();
  }, [load, refreshKey]);

  const openProject = async (id) => {
    setOpening(id);
    try {
      setOpen(await getProject(id));
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not open the catalog');
    } finally {
      setOpening(null);
    }
  };

  const create = async () => {
    const name = newName.trim() || `Eagle Chair Catalog ${new Date().getFullYear()}`;
    try {
      // New catalogs start with a cover and a contents page
      const project = await createProject({
        name,
        document: { settings: { title: name }, pages: [newPage('cover'), newPage('toc')] },
      });
      setCreating(false);
      setNewName('');
      setOpen(project);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not create the catalog');
    }
  };

  const createSample = async () => {
    setBuildingSample(true);
    try {
      const project = await createSampleProject();
      setCreating(false);
      setOpen(project);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not build the sample catalog');
    } finally {
      setBuildingSample(false);
    }
  };

  const duplicate = async (id) => {
    try {
      await duplicateProject(id);
      toast.success('Catalog duplicated');
      load();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not duplicate the catalog');
    }
  };

  const remove = async () => {
    try {
      await deleteProject(confirmDelete.id);
      toast.success('Catalog deleted');
      setConfirmDelete(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not delete the catalog');
    }
  };

  if (open) {
    return (
      <CatalogBuilderEditor
        key={open.id}
        project={open}
        onBack={() => { setOpen(null); load(); }}
      />
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Publishing"
        title="Catalog Builder"
        description="Build print-ready catalogs in the Eagle Chair catalog design from live product data."
        actions={<Button onClick={() => setCreating(true)}><FilePlus2 className="w-4 h-4 mr-2" />New catalog</Button>}
      />

      {loading ? (
        <div className="flex justify-center h-40 items-center"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
      ) : projects.length === 0 ? (
        <Card className="bg-dark-800 border-dark-700 text-center py-14 space-y-4">
          <BookOpen className="w-10 h-10 mx-auto text-dark-400" />
          <div>
            <p className="text-dark-200">No catalogs yet.</p>
            <p className="text-dark-400 text-sm mt-1">
              Start with the sample to see what it can do: it builds a full catalog from your current products and photos.
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button onClick={createSample} disabled={buildingSample}>
              {buildingSample ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Create sample catalog
            </Button>
            <Button variant="outline" onClick={() => setCreating(true)}>Start blank</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="bg-dark-800 border-dark-700 hover:border-primary-500/60 transition-colors flex flex-col">
              <button type="button" className="text-left flex-1" onClick={() => openProject(project.id)}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-dark-50">{project.name}</h3>
                  {opening === project.id && <Loader2 className="w-4 h-4 animate-spin text-primary-400 mt-1" />}
                </div>
                <p className="text-sm text-dark-300 mt-1">{project.page_count} page{project.page_count === 1 ? '' : 's'}</p>
                <p className="text-xs text-dark-400 mt-3">Edited {formatDate(project.updated_at)}</p>
                <p className="text-xs text-dark-400">Last exported {formatDate(project.last_exported_at)}</p>
              </button>
              <div className="flex gap-2 mt-4 pt-3 border-t border-dark-700">
                <Button size="xs" variant="outline" onClick={() => openProject(project.id)}>Open</Button>
                <Button size="xs" variant="ghost" onClick={() => duplicate(project.id)}><Copy className="w-3.5 h-3.5 mr-1" />Duplicate</Button>
                <DeleteGate>
                <Button
                  size="xs"
                  variant="ghost"
                  className="ml-auto text-red-400"
                  onClick={() => setConfirmDelete(project)}
                  aria-label={`Delete ${project.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                </DeleteGate>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={creating} onClose={() => setCreating(false)} title="New catalog" size="md">
        <div className="space-y-5">
          <button
            type="button"
            onClick={createSample}
            disabled={buildingSample}
            className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-primary-500/70 bg-primary-500/10 hover:bg-primary-500/20 text-left disabled:opacity-60"
          >
            {buildingSample
              ? <Loader2 className="w-7 h-7 text-primary-400 shrink-0 animate-spin" />
              : <Sparkles className="w-7 h-7 text-primary-400 shrink-0" />}
            <div>
              <div className="text-dark-50 font-semibold">Sample catalog</div>
              <p className="text-sm text-dark-300 mt-0.5">
                A complete catalog built for you: cover, contents, and product sheets and variations for your
                best-photographed families. Show it as is, or edit it into your own.
              </p>
            </div>
          </button>
          <form className="space-y-3 border-t border-dark-500 pt-4" onSubmit={(e) => { e.preventDefault(); create(); }}>
            <div>
              <div className="text-dark-50 font-semibold">Blank catalog</div>
              <p className="text-sm text-dark-300">Starts with a cover and a contents page; you add the products.</p>
            </div>
            <input
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 outline-none"
              placeholder={`Eagle Chair Catalog ${new Date().getFullYear()}`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="Catalog name"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button size="sm" type="submit">Create blank</Button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete catalog?" size="sm">
        <p className="text-dark-200 text-sm mb-4">
          “{confirmDelete?.name}” will be deleted. Products are not affected, and PDFs already downloaded stay as they are.
        </p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button size="sm" variant="danger" onClick={remove}>Delete</Button>
        </div>
      </Modal>
    </AdminPage>
  );
};

export default CatalogBuilder;
