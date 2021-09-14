describe("Signaling server tests", () => {
	it("joins", () => {
		const name = `Cy_${Cypress._.random(1000)}`;
		cy.task("connect").then((id) => {
			cy.task("join", name).then((user) => {
				expect(name).to.eq(user.name);
				expect(id).to.eq(user.id);
			});
		});
	});
	it("requests", () => {
		cy.task("connect");
		cy.task("requestUsers").then((users) => {
			expect(users).to.have.length(1);
		});
	});
	it("clears", () => {
		cy.task("connect");
		cy.task("clearUsers");
		cy.task("requestUsers").then((users) => {
			expect(users).to.have.length(0);
		});
	});
	// offer, answer, and disconnect are untested
});

import { listInputDevices, selectInputDevice } from "../../src/DeviceSelectorHelper.ts";
describe("Device Selector Helper", () => {
	const onError = (e) => {
		throw new Error(e);
	};
	it("lists devices", () => {
		const inputs = listInputDevices(onError);
	});
	it("plays audio from mic", () => {
		const useStream = (stream) => {
			const audio = new Audio();
			audio.srcObj = stream;
			audio.play();
		};
		selectInputDevice("default", useStream, onError);
	});
});

import User from "../../src/User.ts";
describe("User", () => {
	let user;
	const id = Cypress._.random(1000);
	it("instantiates user", () => {
		user = new User(id);
	});
	it("updates local track", () => {
		let stream;
		const useStream = (stream) => {
			expect(user.updateLocalTrack(stream.getAudioTracks()[0])).to.eq(true);
		};
		selectInputDevice("default", useStream);
	});
});