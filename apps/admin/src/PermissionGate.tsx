import { Button, Result } from 'antd';
import type { ReactNode } from 'react';
import { useT } from './i18n';
import { can, canAny } from './permissions';
import { useAdminUser } from './user-context';

interface PermissionGateProps {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
}

/** Blocks a console page when the signed-in user lacks the required permission. */
export function PermissionGate({ permission, anyOf, children }: PermissionGateProps) {
  const t = useT();
  const user = useAdminUser();
  const allowed = permission ? can(user, permission) : anyOf ? canAny(user, anyOf) : true;
  if (allowed) return <>{children}</>;
  return (
    <Result
      status="403"
      title={t('无权访问此页面')}
      subTitle={t('当前账号没有执行该操作的权限。')}
      extra={
        <Button type="primary" onClick={() => window.history.back()}>
          {t('返回上一页')}
        </Button>
      }
    />
  );
}
