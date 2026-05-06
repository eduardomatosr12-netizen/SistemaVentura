import { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, X, ShieldAlert, Trash2,
  Save, CheckCircle2,
  User, UserCircle,
  RefreshCw, Users,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, PROFILES_TABLE } from '../../lib/supabase';
import { isValidUUID } from '../../lib/uuid';
import { useNavigate } from 'react-router-dom';

interface Employee {
  id: string;
  email: string;
  name: string;
  role: 'funcionario' | 'socio';
  createdAt: string;
}

type ModalType = 'perfil' | 'equipe';

const Configuracoes = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  const [activeModal, setActiveModal] = useState<ModalType | 'delete' | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const [profileData, setProfileData] = useState({ name: '', email: '', phone: '', avatar: '' });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  const [newEmployee, setNewEmployee] = useState({
    email: '',
    name: '',
    role: 'funcionario' as 'funcionario' | 'socio',
  });

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from(PROFILES_TABLE)
          .select('nome, telefone, avatar')
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          if (error.code === '404' || error.message?.includes('not found') || error.message?.includes('no rows')) {
            console.warn('Profiles table not found, using defaults');
            setProfileData({ name: '', email: user.email || '', phone: '(11) 99999-9999', avatar: '' });
            return;
          }
          console.warn('Profile load error:', error.message);
          setProfileData({ name: '', email: user.email || '', phone: '(11) 99999-9999', avatar: '' });
          return;
        }
        
        if (data) {
          setProfileData({
            name: data.nome || '',
            email: user.email || '',
            phone: data.telefone || '(11) 99999-9999',
            avatar: data.avatar || ''
          });
          if (data.avatar) {
            setAvatarPreview(data.avatar);
          }
        }
      } catch (err) {
        console.error('[CONFIG] Erro ao carregar perfil:', err);
        setProfileData({ name: '', email: user.email || '', phone: '(11) 99999-9999', avatar: '' });
      }
    };
    loadData();
  }, [user?.id]);

  const loadEmployees = async () => {
    if (!user?.id) return;
    setIsLoadingEmployees(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error('[CONFIG] Erro ao carregar funcionários:', err);
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadEmployees();
    }
  }, [user?.id]);

  const handleAddEmployee = async () => {
    if (!newEmployee.email.trim() || !newEmployee.name.trim()) {
      setInviteError('Preencha todos os campos');
      return;
    }

    if (employees.some(emp => emp.email === newEmployee.email)) {
      setInviteError('Email já cadastrado');
      return;
    }

    // Validar se user.id é um UUID válido
    if (!user?.id || !isValidUUID(user.id)) {
      setInviteError('ID de usuário inválido. Faça logout e login novamente.');
      console.error('[CONFIG] user.id inválido:', user?.id);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('employees')
        .insert([{
          user_id: user.id,
          email: newEmployee.email.trim(),
          name: newEmployee.name.trim(),
          role: newEmployee.role,
        }])
        .select()
        .single();

      if (error) throw error;

      setEmployees([...employees, data]);
      setNewEmployee({ email: '', name: '', role: 'funcionario' });
      setInviteSuccess('Funcionário adicionado!');
      setInviteError('');
      setTimeout(() => setInviteSuccess(''), 3000);
    } catch (err: any) {
      console.error('[CONFIG] Erro ao adicionar funcionário:', err);
      setInviteError(err.message || 'Erro ao adicionar funcionário');
    }
  };

  const handleRemoveEmployee = async (id: string) => {
    if (!confirm('Remover funcionário?')) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEmployees(employees.filter(emp => emp.id !== id));
    } catch (err: any) {
      console.error('[CONFIG] Erro ao remover funcionário:', err);
      setInviteError(err.message || 'Erro ao remover funcionário');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[CONFIG] handleSaveProfile iniciado', { userId: user?.id, name: profileData.name });
    
    if (!user?.id) {
      setProfileError('Usuário não autenticado');
      console.error('[CONFIG] Erro: usuário não autenticado');
      return;
    }
    if (!profileData.name.trim()) {
      setProfileError('Nome não pode ser vazio');
      console.error('[CONFIG] Erro: nome vazio');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (profileData.email && profileData.email.trim() && !emailRegex.test(profileData.email.trim())) {
      setProfileError('Email profissional inválido');
      console.error('[CONFIG] Erro: email inválido');
      return;
    }
    
    setIsSavingProfile(true);
    setProfileError('');
    setProfileSuccess('');
    
    try {
      console.log('[CONFIG] Tentando salvar no Supabase...');
      
      const updateData: Record<string, unknown> = { 
        nome: profileData.name.trim(),
        telefone: profileData.phone.trim()
      };
      
      if (avatarPreview && avatarPreview !== profileData.avatar) {
        updateData.avatar = avatarPreview;
      }
      
      console.log('[CONFIG] Dados a salvar:', updateData);
      
      const { data, error } = await supabase
        .from(PROFILES_TABLE)
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single();
      
      console.log('[CONFIG] Resposta do Supabase:', { data, error });
      
      if (error) {
        console.error('[CONFIG] Erro do Supabase:', error);
        throw error;
      }
      
      console.log('[CONFIG] Perfil salvo com sucesso!');
      setProfileSuccess('Perfil atualizado com sucesso!');
      setProfileData(prev => ({ ...prev, avatar: avatarPreview || prev.avatar, email: profileData.email.trim() || prev.email }));
      setTimeout(() => {
        console.log('[CONFIG] Fechando modal...');
        setProfileSuccess('');
        setActiveModal(null);
      }, 1500);
    } catch (err: any) {
      console.error('[CONFIG] Erro ao salvar perfil:', err);
      const errorMessage = err.message || 'Erro ao salvar perfil. Tente novamente.';
      setProfileError(errorMessage);
    } finally {
      console.log('[CONFIG] Finalizando, isSavingProfile:', false);
      setIsSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setProfileError('Apenas PNG ou JPG são aceitos');
      return;
    }
    
    setIsUploadingAvatar(true);
    setProfileError('');
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/avatar-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);
      
      setAvatarPreview(publicUrl);
      setProfileSuccess('Avatar atualizado! Clique em Salvar para confirmar.');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err: any) {
      console.error('[CONFIG] Erro ao fazer upload:', err);
      setProfileError('Erro ao fazer upload. Tente novamente.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmationText !== 'DELETE') return;
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const keysToRemove = Object.keys(localStorage).filter(key => key.startsWith('axium_'));
    keysToRemove.forEach(key => localStorage.removeItem(key));
    logout();
    navigate('/login');
  };

  const sections = [
    { id: 'perfil' as ModalType, icon: User, title: 'Perfil', description: 'Gerencie nome, email e foto de perfil', items: ['Nome', 'Email', 'Foto de perfil'] },
    { id: 'equipe' as ModalType, icon: Users, title: 'Equipe', description: 'Convidar membros e gerenciar acessos', items: ['Convidar', 'Permissões', 'Membros'] },
  ];

  return (
    <div className="min-h-screen pb-20 relative">
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-black tracking-tighter mb-1">Configurações</h1>
          <p className="text-neutral-500 text-sm font-medium">Controle central de perfil e preferências.</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-4">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="bg-white border border-neutral-200 rounded-3xl p-8 hover:border-black transition-all group relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-neutral-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-black transition-colors">
                    <Icon className="w-8 h-8 text-neutral-400 group-hover:text-white transition-colors" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="font-black text-black text-lg tracking-tight">{section.title}</h3>
                    <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1">{section.description}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveModal(section.id)}
                  className="bg-black text-white px-6 py-3 rounded-md font-black text-[11px] uppercase tracking-widest hover:bg-neutral-800 transition-all active:scale-[0.95] shadow-lg shadow-black/10"
                >
                  Configurar
                </button>
              </div>
              <div className="flex gap-2 flex-wrap mt-8 pt-8 border-t border-neutral-50">
                {section.items.map((item, itemIdx) => (
                  <span key={itemIdx} className="px-4 py-2 bg-neutral-50 text-neutral-400 text-[10px] font-black uppercase tracking-[1.5px] rounded-md border border-neutral-100">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 max-w-2xl border-2 border-red-50 bg-red-50/20 rounded-[40px] p-10 relative overflow-hidden group/danger">
        <div className="absolute -right-10 -bottom-10 opacity-5 group-hover/danger:opacity-10 transition-opacity">
          <ShieldAlert size={240} className="text-red-500" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="text-red-600" size={24} />
            <h3 className="font-black text-red-600 uppercase tracking-widest text-sm">Zona de Perigo</h3>
          </div>
          <p className="text-sm text-neutral-500 font-bold leading-relaxed mb-8 max-w-md">Estas ações são irreversíveis e deletarão todos os seus dados e leads permanentemente.</p>
          <button 
            onClick={() => setActiveModal('delete')}
            className="text-[11px] font-black uppercase tracking-[2px] bg-white border-2 border-red-100 text-red-600 px-10 py-4 rounded-2xl hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-xl shadow-red-100/50 active:scale-[0.98]"
          >
            Deletar Conta Permanentemente
          </button>
        </div>
      </div>

      {activeModal && activeModal !== 'delete' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white border border-neutral-200 rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden transform animate-in slide-in-from-bottom-8 duration-500">
            {activeModal === 'perfil' ? (
              <form onSubmit={handleSaveProfile}>
                <div className="px-12 py-10 border-b border-neutral-100 flex justify-between items-start bg-neutral-50/30">
                  <div>
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[3px] mb-3 block">Preferências do Sistema</span>
                    <h2 className="text-4xl font-black text-black tracking-tighter">Configurações de Perfil</h2>
                  </div>
                  <button type="button" onClick={() => { setActiveModal(null); setProfileError(''); setProfileSuccess(''); }} className="p-3 hover:bg-white rounded-2xl transition-colors text-neutral-300 hover:text-black border border-transparent hover:border-neutral-200 shadow-sm">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-12 space-y-10 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {profileError && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium">
                      <AlertCircle size={20} />
                      {profileError}
                    </div>
                  )}
                  {profileSuccess && (
                    <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-600 text-sm font-medium">
                      <CheckCircle2 size={20} />
                      {profileSuccess}
                    </div>
                  )}
                  <div className="space-y-8">
                    <div className="flex items-center gap-8 mb-4">
                      <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center relative group/avatar cursor-pointer overflow-hidden" onClick={() => avatarInputRef.current?.click()}>
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <UserCircle size={48} className="text-white" />
                        )}
                        <div className="absolute inset-0 bg-black/60 rounded-3xl opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest text-center px-2">
                          {isUploadingAvatar ? 'Enviando...' : 'Alterar Foto'}
                        </div>
                        <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/jpg" onChange={handleAvatarUpload} className="hidden" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-black text-black text-lg">Avatar do Administrador</h4>
                        <p className="text-xs text-neutral-400 font-medium">Clique para fazer upload de um novo arquivo PNG ou JPG.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Nome Completo</label>
                        <input type="text" value={profileData.name} onChange={(e) => setProfileData({...profileData, name: e.target.value})} className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-2xl px-6 py-4 font-bold text-black focus:border-black outline-none transition-all" placeholder="Seu nome completo" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Email Profissional</label>
                        <input type="email" value={profileData.email} onChange={(e) => setProfileData({...profileData, email: e.target.value})} className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-2xl px-6 py-4 font-bold text-black focus:border-black outline-none transition-all" placeholder="seu@email.com" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-12 py-10 bg-neutral-50 flex gap-4">
                  <button type="button" onClick={() => setActiveModal(null)} className="flex-1 py-5 rounded-[20px] font-black text-[11px] uppercase tracking-widest text-neutral-400 hover:text-black hover:bg-neutral-100 transition-all border border-transparent hover:border-neutral-200">Cancelar</button>
                  <button type="submit" disabled={isSavingProfile} className="flex-[2] text-white py-5 rounded-[20px] font-black text-[11px] uppercase tracking-widest hover:brightness-90 transition-all active:scale-[0.98] shadow-2xl flex items-center justify-center gap-3" style={{ backgroundColor: 'var(--primary)' }}>
                    {isSavingProfile ? <><RefreshCw size={18} className="animate-spin" /> Salvando...</> : <><Save size={18} /> Salvar Perfil</>}
                  </button>
                </div>
                </form>
            ) : activeModal === 'equipe' ? (
              <div>
                <div className="px-12 py-10 border-b border-neutral-100 flex justify-between items-start bg-neutral-50/30">
                  <div>
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[3px] mb-3 block">Preferências do Sistema</span>
                    <h2 className="text-4xl font-black text-black tracking-tighter">Equipe</h2>
                  </div>
                  <button type="button" onClick={() => { setActiveModal(null); setInviteError(''); setInviteSuccess(''); }} className="p-3 hover:bg-white rounded-2xl transition-colors text-neutral-300 hover:text-black border border-transparent hover:border-neutral-200 shadow-sm">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-12 space-y-10 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {inviteError && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium">
                      <AlertCircle size={20} />
                      {inviteError}
                    </div>
                  )}
                  {inviteSuccess && (
                    <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-600 text-sm font-medium">
                      <CheckCircle2 size={20} />
                      {inviteSuccess}
                    </div>
                  )}
                  <div className="space-y-8">
                    <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex items-center gap-4">
                      <Users className="text-blue-500" size={32} />
                      <div>
                        <p className="text-sm font-black text-blue-900">Gerencie sua Equipe</p>
                        <p className="text-xs text-blue-600 font-medium">Adicione e gerencie membros da equipe.</p>
                      </div>
                    </div>
                    <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 space-y-4">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Nome Completo</label>
                        <input type="text" value={newEmployee.name} onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})} placeholder="João Silva" className="w-full bg-white border-2 border-neutral-100 rounded-xl px-4 py-3 font-bold text-black focus:border-black outline-none transition-all" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">E-mail</label>
                        <input type="email" value={newEmployee.email} onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})} placeholder="joao@empresa.com" className="w-full bg-white border-2 border-neutral-100 rounded-xl px-4 py-3 font-bold text-black focus:border-black outline-none transition-all" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Cargo</label>
                        <select value={newEmployee.role} onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value as 'funcionario' | 'socio'})} className="w-full bg-white border-2 border-neutral-100 rounded-xl px-4 py-3 font-bold text-black focus:border-black outline-none transition-all">
                          <option value="funcionario">Funcionário</option>
                          <option value="socio">Sócio</option>
                        </select>
                      </div>
                      <button type="button" onClick={handleAddEmployee} className="w-full py-4 bg-black text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center justify-center gap-2">
                        <Users size={16} /> Adicionar Funcionário
                      </button>
                    </div>
                    {employees.length > 0 && (
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Funcionários Cadastrados ({employees.length})</label>
                        {employees.map((emp) => (
                          <div key={emp.id} className="p-4 bg-white border border-neutral-200 rounded-xl flex items-center justify-between">
                            <div>
                              <p className="font-black text-black">{emp.name}</p>
                              <p className="text-sm text-neutral-500 font-medium">{emp.email}</p>
                              <p className="text-xs text-neutral-400 font-medium uppercase">Cargo: {emp.role === 'socio' ? 'Sócio' : 'Funcionário'}</p>
                            </div>
                            <button type="button" onClick={() => handleRemoveEmployee(emp.id)} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-bold text-xs uppercase hover:bg-red-100 transition-all">
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-12 py-10 bg-neutral-50">
                  <button type="button" onClick={() => setActiveModal(null)} className="w-full py-5 rounded-[20px] font-black text-[11px] uppercase tracking-widest text-neutral-400 hover:text-black hover:bg-neutral-100 transition-all border border-transparent hover:border-neutral-200">Fechar</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {activeModal === 'delete' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white border-2 border-red-100 rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden p-12 text-center transform animate-in slide-in-from-bottom-8">
            <div className="w-24 h-24 bg-red-50 rounded-[32px] flex items-center justify-center mx-auto mb-8 animate-bounce"><Trash2 size={48} className="text-red-600" /></div>
            <h2 className="text-4xl font-black text-black tracking-tighter mb-4">Tem certeza?</h2>
            <p className="text-neutral-500 text-sm font-bold leading-relaxed mb-10">Esta ação é irreversível e apagará todos os dados permanentemente.</p>
            <div className="space-y-8 text-left">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block text-center">Digite <span className="text-black font-black">DELETE</span> para confirmar</label>
                <input autoFocus type="text" value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} placeholder="CONFIRMAÇÃO" className="w-full bg-red-50/50 border-2 border-red-100 rounded-3xl px-8 py-5 text-center text-xl font-black text-red-600 focus:border-red-600 outline-none" />
              </div>
              <div className="flex flex-col gap-4">
                <button disabled={confirmationText !== 'DELETE' || isDeleting} onClick={handleDeleteAccount} className={`w-full py-5 rounded-[24px] font-black text-[11px] uppercase tracking-[2px] shadow-2xl transition-all flex items-center justify-center gap-3 ${confirmationText === 'DELETE' ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200' : 'bg-neutral-100 text-neutral-300 cursor-not-allowed'}`}>{isDeleting ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : 'Deletar Conta e Dados'}</button>
                <button onClick={() => { setActiveModal(null); setConfirmationText(''); }} className="w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest text-neutral-400 hover:text-black">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Configuracoes;