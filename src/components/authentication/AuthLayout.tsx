
import React from "react";
import { Shield } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-teal-50 dark:from-securetalk-primary dark:to-securetalk-secondary p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-primary/90 p-3 rounded-full mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-center mb-1">SecureTalk</h1>
          <h2 className="text-xl font-bold text-center mb-1">{title}</h2>
          <p className="text-muted-foreground text-center">{subtitle}</p>
        </div>

        <div className="auth-card">
          {children}
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Secure. Private. Trusted.</p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
