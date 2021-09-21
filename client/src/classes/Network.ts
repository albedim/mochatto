import { PeerProcessor } from "./PeerProcessor";
import { AudioVisualizer } from "./AudioVisualizer";
import { UserInfo } from "../contexts/UserInfoContext";
import { Socket } from "socket.io-client";

export const DCLabel = "DATACHANNEL";

export interface Pack {
  sdp: RTCSessionDescription;
  userId: string;
  receiverId: string;
  kind: string;
}

export const timeout = 3000;

export class Network {
  socket: Socket;
  peerProcessors: PeerProcessor[];
  addUserInfo: (id) => (info: UserInfo) => void;
  selfUserInfo: UserInfo;
  stream: MediaStream;
  constructor(
    socket: Socket,
    userName: string,
    addUserInfo: (id) => (info: UserInfo) => void,
    selfUserInfo: UserInfo,
    stream: MediaStream
  ) {
    this.socket = socket;
    this.peerProcessors = [];
    this.addUserInfo = addUserInfo;
    this.selfUserInfo = selfUserInfo;
    this.stream = stream;

    // AS A NEW COMER
    socket.emit("JOIN", userName);

    socket.on("OFFER", (dataString) => {
      const offerPack = JSON.parse(dataString);
      const peerId = offerPack.userId;
      let peerProcessor = this.findPeerProcessorById(peerId);
      if (!peerProcessor) {
        peerProcessor = this.pushToNetwork(peerId);
      }
      const peerConnection = peerProcessor.peerConnection;
      peerConnection
        .setRemoteDescription(offerPack.sdp) // set remote description as the peerProcessor's
        .then(() => {
          socket.emit("SDP_RECEIVED", peerId);
          socket.on("ICE_CANDIDATE", (dataString) => {
            const data = JSON.parse(dataString);
            peerConnection.addIceCandidate(data.ice).catch((e) => console.warn(e));
          });

          peerConnection
            .createAnswer()
            .then((answer) => {
              return peerConnection.setLocalDescription(answer);
            })
            .then(() => {
              if (peerConnection.localDescription) {
                const iceCandidates: RTCIceCandidate[] = [];
                peerConnection.onicecandidate = (event) => {
                  if (event.candidate) {
                    iceCandidates.push(event.candidate);
                  }
                };
                socket.on("SDP_RECEIVED", () => {
                  iceCandidates.forEach((iceCandidate) => {
                    socket.emit(
                      "ICE_CANDIDATE",
                      JSON.stringify({ ice: iceCandidate, receiverId: peerId })
                    );
                  });
                  peerConnection.onicecandidate = (event) => {
                    if (peerConnection.iceGatheringState === "gathering") {
                      if (event.candidate) {
                        socket.emit(
                          "ICE_CANDIDATE",
                          JSON.stringify({ ice: event.candidate, receiverId: peerId })
                        );
                      }
                    }
                  };
                });
                // create the answer
                const answerPack: Pack = {
                  sdp: peerConnection.localDescription,
                  userId: socket.id,
                  receiverId: offerPack.userId,
                  kind: "answer",
                };

                socket.emit("ANSWER", JSON.stringify(answerPack));
              }
            })
            .catch((e) => {
              console.error(e);
            });
        })
        .catch((e) => {
          console.error(e);
        });
    });

    // AS AN EXISTING USER
    socket.on("JOIN", ({ id }) => {
      if (id != socket.id) {
        const peerProcessor = this.pushToNetwork(id);
        peerProcessor.sendOffer();
      }
    });

    socket.on("LEAVE", ({ id }) => {
      this.removeFromNetwork(id);
    });

    socket.on("ANSWER", (dataString) => {
      const answerPack = JSON.parse(dataString);
      const peerId = answerPack.userId;
      const peerConnection = this.findPeerProcessorById(peerId).peerConnection;
      peerConnection
        .setRemoteDescription(answerPack.sdp)
        .then(() => {
          socket.emit("SDP_RECEIVED", peerId);
          socket.on("ICE_CANDIDATE", (dataString) => {
            const data = JSON.parse(dataString);
            peerConnection.addIceCandidate(data.ice).catch((e) => console.warn(e));
          });
        })
        .catch((e) => {
          console.error(e);
        });
    });
  }

  // add peerProcessor to the network
  pushToNetwork(id: string): PeerProcessor {
    const peerProcessor = new PeerProcessor(id, this.socket, this.addUserInfo(id));
    peerProcessor.initialize(
      this.selfUserInfo,
      new AudioVisualizer(peerProcessor.onAudioActivity.bind(peerProcessor))
    );
    this.peerProcessors.push(peerProcessor);
    this.updateAllTracks(this.stream.getAudioTracks()[0]);
    this.broadcastInfo(this.selfUserInfo);
    return peerProcessor;
  }

  // remove peerProcessor to the network
  removeFromNetwork(id: string): void {
    const peerProcessorIndex = this.peerProcessors.findIndex(
      (peerProcessor) => peerProcessor.peerId === id
    );
    if (this.peerProcessors[peerProcessorIndex]) {
      this.peerProcessors.splice(peerProcessorIndex, 1);
    }
  }

  // return peerProcessor list
  getPeerProcessors(): PeerProcessor[] {
    return this.peerProcessors;
  }

  findPeerProcessorById(id: string): PeerProcessor {
    const peerProcessor = this.peerProcessors.find((pp) => pp.peerId === id);
    return peerProcessor as PeerProcessor;
  }

  // update tracks for all peer connections
  updateAllTracks(track: MediaStreamTrack): void {
    this.peerProcessors.forEach((peerProcessor) => {
      peerProcessor.updateRemoteTrack(track);
    });
  }

  updateInfo(info: UserInfo): void {
    this.selfUserInfo = info;
    this.broadcastInfo(info);
  }

  broadcastInfo(info: UserInfo): void {
    this.peerProcessors.forEach((peerProcessor) => {
      peerProcessor.send(info);
    });
  }
}