
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { validateEmail, validatePassword, validatePasswordMatch, validateName } from "./AuthValidation";
import LoadingSpinner from "./LoadingSpinner";

const EnhancedRegisterForm: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp, signInWithGoogle } = useAuth();

  const validateForm = (): boolean => {
    const newErrors = {
      name: "",
      email: "",
      password: "",
      confirmPassword: ""
    };
    
    let isValid = true;
    
    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      newErrors.name = nameValidation.message;
      isValid = false;
    }
    
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      newErrors.email = emailValidation.message;
      isValid = false;
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.message;
      isValid = false;
    }
    
    const passwordMatchValidation = validatePasswordMatch(password, confirmPassword);
    if (!passwordMatchValidation.isValid) {
      newErrors.confirmPassword = passwordMatchValidation.message;
      isValid = false;
    }
    
    setErrors(newErrors);
    return isValid;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Register form submitted with email:', email);
    
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await signUp(email, password, name);
      
      if (error) {
        console.error('Registration error:', error);
        let errorMessage = "Registration failed";
        
        if (error.message.includes("User already registered")) {
          errorMessage = "An account with this email already exists. Please try logging in instead.";
        } else if (error.message.includes("Password should be at least")) {
          errorMessage = "Password does not meet security requirements.";
        } else if (error.message.includes("Invalid email")) {
          errorMessage = "Please enter a valid email address.";
        } else if (error.message.includes("Signup is disabled")) {
          errorMessage = "Account registration is currently disabled. Please contact support.";
        } else {
          errorMessage = error.message;
        }
        
        toast({
          title: "Registration failed",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        console.log('Registration successful, redirecting to login');
        toast({
          title: "Account created successfully!",
          description: "You can now sign in with your credentials.",
        });
        navigate("/login");
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Registration failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    console.log('Google signup button clicked');
    setIsLoading(true);
    
    try {
      const { error } = await signInWithGoogle();
      
      if (error) {
        console.error('Google signup error:', error);
        let errorMessage = "Google signup failed";
        
        if (error.message.includes("popup_closed")) {
          errorMessage = "Signup popup was closed. Please try again.";
        } else if (error.message.includes("network")) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes("redirect")) {
          errorMessage = "Redirect error. Please ensure your browser allows popups.";
        } else {
          errorMessage = error.message;
        }
        
        toast({
          title: "Google signup failed",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        console.log('Google signup initiated successfully');
        toast({
          title: "Redirecting...",
          description: "Please complete the Google authentication.",
        });
      }
    } catch (error) {
      console.error("Google signup error:", error);
      toast({
        title: "Google signup failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearFieldError = (field: keyof typeof errors) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <form onSubmit={handleRegister} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          placeholder="John Doe"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearFieldError('name');
          }}
          disabled={isLoading}
          className={errors.name ? "border-red-500" : ""}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearFieldError('email');
          }}
          disabled={isLoading}
          className={errors.email ? "border-red-500" : ""}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearFieldError('password');
          }}
          disabled={isLoading}
          className={errors.password ? "border-red-500" : ""}
        />
        {errors.password && (
          <p className="text-sm text-red-500">{errors.password}</p>
        )}
        <div className="text-xs text-muted-foreground">
          Password must be at least 8 characters with uppercase, lowercase, number, and special character.
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            clearFieldError('confirmPassword');
          }}
          disabled={isLoading}
          className={errors.confirmPassword ? "border-red-500" : ""}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-red-500">{errors.confirmPassword}</p>
        )}
      </div>

      <Button 
        type="submit" 
        className="w-full bg-gradient-to-r from-primary to-accent"
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="flex items-center">
            <LoadingSpinner size="sm" className="mr-2" />
            Creating account...
          </span>
        ) : (
          <span className="flex items-center">
            <UserPlus className="mr-2 h-4 w-4" /> Create Account
          </span>
        )}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      <Button 
        type="button"
        variant="outline" 
        className="w-full"
        onClick={handleGoogleSignUp}
        disabled={isLoading}
      >
        {isLoading ? (
          <LoadingSpinner size="sm" className="mr-2" />
        ) : (
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        Continue with Google
      </Button>

      <div className="text-center mt-4">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link 
            to="/login" 
            className="text-primary font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
};

export default EnhancedRegisterForm;
