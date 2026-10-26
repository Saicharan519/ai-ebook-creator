import {useState} from 'react';
import{Link,useNavigate} from 'react-router-dom';
import {Mail,Lock,BookOpen} from 'lucide-react';
import toast from 'react-hot-toast';

import InputField from '../components/ui/InputField';
import Button from '../components/ui/Button';
import {useAuth} from '../context/Authcontext';
import axiosInstance from '../utils/axiosdistance';
import {API_PATHS} from '../utils/Apipath';


const LoginPages = () => {
  const[formData,setFormData]=useState({email:"",password:""});
  const [isLoading, setIsLoading] = useState(false);
  const{login}=useAuth();
  const navigate=useNavigate();

  const handleChange=(e)=>{
    setFormData({...formData,[e.target.name]:e.target.value});
  };
  const handleSubmit=async(e)=>{
    e.preventDefault();
    setIsLoading(true);
    try{
      const response=await axiosInstance.post(API_PATHS.AUTH.LOGIN,formData);
      const {token}=response.data;

      const profileResponse=await axiosInstance.get(API_PATHS.AUTH.GET_PROFILE,{
        headers:{
          Authorization:`Bearer ${token}`,
        },
      });
      login(profileResponse.data,token);
      toast.success("Login successful");
      navigate("/dashboard");
    }catch(error){
      localStorage.clear();
      toast.error(error.response?.data?.message || "Login failed");
    }finally{
      setIsLoading(false);
    }
  };


  return (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div className="max-w-md w-full">
      <div className="text-center mb-8">
        <BookOpen className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-500 to-violet-700 text-white" />

  </div>
  <h1 className="text-3xl font-bold text-slate-900">welcome Back</h1>
  <p className="text-slate-600">Please sign in to your account</p>
    </div>
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField
        label="Email"
        name="email"
        type="email"
        placeholder="Enter your email"
        icon={Mail}
        value={formData.email}
        onChange={handleChange}
        required
        />
        <InputField
        label="Password"
        name="password"
        type="password"
        placeholder=".........."
        icon={Lock}
        value={formData.password}
        onChange={handleChange}
        required
        />
        <Button type="submit" isLoading={isLoading} className="w-full">
          sign in
        </Button>
      </form>
      <p className="text-center text-sm text-slate-600 mt-4">
        Don't have an account?{" "}
        <Link to="/signup" className="font-medium text-violet-600 hover:text-violet-500">
          Sign up
        </Link>
      </p>
    </div>  
    </div>
  
  );
};

export default LoginPages;

