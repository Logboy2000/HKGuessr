import "./Button.css"
import { Link } from "react-router-dom"

export default function Button({ href, children, ...props }) {
  const isExternal =
    href?.startsWith("http") ||
    href?.startsWith("mailto:") ||
    href?.startsWith("tel:")

  if (!href) {
    return (
      <button className="hk-button" {...props}>
        {children}
      </button>
    )
  }

  if (isExternal) {
    return (
      <a className="hk-button" href={href} {...props}>
        {children}
      </a>
    )
  }

  return (
    <Link className="hk-button" to={href} {...props}>
      {children}
    </Link>
  )
}