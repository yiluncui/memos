import { Navigate, useParams } from "react-router-dom";
import { memoNamePrefix } from "@/helpers/resource-names";

// Resolves a short memo permalink (/m/:uid) to its canonical detail page.
const MemoPermalinkRedirect = () => {
  const { uid } = useParams();
  if (!uid) {
    return <Navigate to="/404" replace />;
  }
  return <Navigate to={`/${memoNamePrefix}${uid}`} replace />;
};

export default MemoPermalinkRedirect;
