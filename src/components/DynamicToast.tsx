import dynamic from 'next/dynamic';
import ClientOnlyWrapper from './ClientOnlyWrapper';

// Dynamically import ToastContainer to prevent server-side rendering
const ToastContainer = dynamic(
  () => import('react-toastify').then(mod => mod.ToastContainer),
  {
    ssr: false,
    loading: () => null
  }
);

export default function DynamicToast() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={4000}
      hideProgressBar={false}
      newestOnTop={true}
      closeOnClick={true}
      rtl={false}
      pauseOnFocusLoss={true}
      draggable={true}
      pauseOnHover={true}
      theme="light"
      toastClassName="romantic-toast"
      progressClassName="romantic-progress"
    />
  );
}
