import "./Button.css"

export default function HKButton(props) {
  return (
    <a className="hk-button" href={props.href}>
      {props.children}
    </a>
  )
}