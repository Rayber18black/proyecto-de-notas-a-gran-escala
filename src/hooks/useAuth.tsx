import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { usersApi, delegationsApi } from "@/lib/api";

type Role = "root" | "admin" | "docente" | "student";

interface Perms {
  p_doc_1: boolean; p_doc_3: boolean;
  p_adm_2: boolean; p_adm_3: boolean; p_adm_4: boolean; p_adm_5: boolean; p_adm_6: boolean;
  p_rot_2: boolean; p_rot_3: boolean; p_rot_4: boolean; p_rot_5: boolean; p_rot_6: boolean; p_rot_7: boolean;
  p_own_2: boolean; p_own_4: boolean; p_own_5: boolean;
  can_manage_roles: boolean; can_delete_audit: boolean; can_config_system: boolean; can_export_backups: boolean;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: Role[];
  profile: { nombre: string; ci: string | null } | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isStaff: boolean;
  isRoot: boolean;
  isOwner: boolean;
  perms: Perms;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [profile, setProfile] = useState<AuthCtx["profile"]>(null);
  const [loading, setLoading] = useState(true);
  const [delegations, setDelegations] = useState<any>({});

  const loadExtras = async (uid: string) => {
    try {
      const data = await usersApi.getById(uid);
      setRoles(data.roles || []);
      setProfile(data.profile || null);
      
      try {
        const dels = await delegationsApi.list();
        const myDel = dels.find((d: any) => d.user_id === uid) || {};
        setDelegations(myDel);
      } catch (e) { console.error("Error loading delegations", e); }
    } catch (error) {
      console.error("Error loading local auth extras:", error);
      setRoles([]);
      setProfile(null);
    }
  };

  useEffect(() => {
    // 1. Verificar si hay un usuario local primero (Bypass)
    const localUserStr = localStorage.getItem('local_user');
    if (localUserStr) {
      try {
        const localUser = JSON.parse(localUserStr);
        setUser(localUser);
        loadExtras(localUser.id);
        setLoading(false);
      } catch (e) {
        localStorage.removeItem('local_user');
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user) {
        setSession(s);
        setUser(s.user);
        setTimeout(() => loadExtras(s.user.id), 0);
      } else if (!localStorage.getItem('local_user')) {
        setSession(null);
        setUser(null);
        setRoles([]);
        setProfile(null);
        setDelegations({});
      }
    });

    if (!localStorage.getItem('local_user')) {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (s?.user) {
          setSession(s);
          setUser(s.user);
          loadExtras(s.user.id).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      });
    }

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    localStorage.removeItem('local_user');
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const isOwner = user?.email === 'rayber@local.app';
  const isAdmin = roles.includes("root") || roles.includes("admin") || isOwner;
  const isStaff = isAdmin || roles.includes("docente");
  const isRoot = roles.includes("root") || isOwner;

  const finalProfile = profile || (isOwner ? { nombre: "Rayber (Sistema)", ci: "ROOT" } : null);

  const perms: Perms = {
    p_doc_1: isOwner || isRoot || isAdmin || isStaff || !!delegations.p_doc_1,
    p_doc_3: isOwner || isRoot || isAdmin || isStaff || !!delegations.p_doc_3,
    p_adm_2: isOwner || isRoot || isAdmin || !!delegations.p_adm_2,
    p_adm_3: isOwner || isRoot || isAdmin || !!delegations.p_adm_3,
    p_adm_4: isOwner || isRoot || isAdmin || !!delegations.p_adm_4,
    p_adm_5: isOwner || isRoot || isAdmin || !!delegations.p_adm_5,
    p_adm_6: isOwner || isRoot || isAdmin || !!delegations.p_adm_6,
    p_rot_2: isOwner || isRoot || !!delegations.p_rot_2,
    p_rot_3: isOwner || isRoot || !!delegations.p_rot_3,
    p_rot_4: isOwner || isRoot || !!delegations.p_rot_4,
    p_rot_5: isOwner || isRoot || !!delegations.p_rot_5,
    p_rot_6: isOwner || isRoot || !!delegations.p_rot_6,
    p_rot_7: isOwner || isRoot || !!delegations.p_rot_7,
    p_own_2: isOwner || !!delegations.p_own_2,
    p_own_4: isOwner || !!delegations.p_own_4,
    p_own_5: isOwner || !!delegations.p_own_5,
    can_manage_roles: isOwner || !!delegations.can_manage_roles,
    can_delete_audit: isOwner || !!delegations.can_delete_audit,
    can_config_system: isOwner || !!delegations.can_config_system,
    can_export_backups: isOwner || !!delegations.can_export_backups,
  };

  return (
    <Ctx.Provider value={{ user, session, roles, profile: finalProfile, loading, signOut, isAdmin, isStaff, isRoot, isOwner, perms }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
};