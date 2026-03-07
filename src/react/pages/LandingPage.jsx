import Changelog from "../components/Changelog/Changelog"
import Button from "../components/Button/Button"
import { useEffect } from "react"

export default function LandingPage() {
	useEffect(() => {

		const style = document.createElement("link")
		style.rel = "stylesheet"
		style.href = "/src/react/pages/LandingPage.css"
		document.head.appendChild(style)

		return () => {
			document.head.removeChild(style)
		}
	}, [])
	return (
		<>
			<div
				style={{ animation: "fadeIn 1.5s cubic-bezier(0.075, 0.82, 0.165, 1)" }}
			>
				<img
					src="/images/logo.png"
					alt="Hollow Guessr logo - A Hollow Knight GeoGuessing Game"
					id="title-image"
					className="moving"
				/>
				<div className="button-container moving">
					<Button href="game.html">Play</Button>
					<Button href="editor.html">Pack Editor</Button>
					<Button href="donate.html">Donate</Button>
					<Button href="discord.html">Discord</Button>
					<Button href="https://github.com/Logboy2000/HKGuessr">GitHub</Button>
					<Button href="/credits">Credits</Button>
				</div>
			</div>

			<Changelog
				changes={[
					"Credits page fixed and updated!!!",
					"Fixed missing Favicon",
					"Decrease Game Loading Time by moving to CDN",
					"New Pack: All NPCs",
					"New Pack: All Abilities",
				]}
			></Changelog>

			<footer id="footer-info">
				<span>v1.12.7</span>
				<span>
					A game by{" "}
					<a
						href="https://loganhowarth.pages.dev/"
						target="_blank"
						rel="noopener noreferrer"
						style={{ textDecoration: "underline" }}
					>
						Logan Howarth
					</a>
				</span>
			</footer>
		</>
	)
}
