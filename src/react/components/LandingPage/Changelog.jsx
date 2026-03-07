import "./Changelog.css"

/**
 *
 * @param {string[]} changes String array that contains recent changes
 * @returns
 */
export default function Changelog({ changes = []}) {
	return (
		<>
			<div id="changelog">
				<h3>New Stuff:</h3>
				<ul>
					{changes.map((item, index) => (
						<li key={index}>{item}</li>
					))}
				</ul>
			</div>
		</>
	)
}
