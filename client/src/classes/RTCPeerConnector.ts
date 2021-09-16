import User from "./User";
import { Socket } from "socket.io-client";
import { UserInfo } from "../contexts/UserInfoContext";

export const Pack = ({
  sdp,
  senderId,
  receiverId,
  kind,
}: {
  sdp: RTCSessionDescription;
  senderId: string;
  receiverId: string;
  kind: string;
}): { sdp: RTCSessionDescription; senderId: string; receiverId: string; kind: string } => {
  return { sdp, senderId, receiverId, kind };
};

const users: User[] = [];
const defaultOn = () => {
  return;
};

const avatarChannelLabel = "AVATAR_DC";
const userInfoChannelLabel = "USER_INFO_DC";

// send out offer to every user on network
export const sendOffer = (socket: Socket, onOfferSent: (Pack) => void = defaultOn): void => {
  // for each user
  users.forEach((user) => {
    // if a datachannel is already open, close it
    if (user.avatarDC) {
      user.avatarDC.close();
    }
    if (user.userInfoDC) {
      user.userInfoDC.close();
    }

    // create data channel for the user as the caller
    user.avatarDC = user.peerConnection.createDataChannel(avatarChannelLabel);
    user.avatarDC.onopen = user.onAvatarDCOpen.bind(user);
    user.avatarDC.onclose = user.onAvatarDCClose.bind(user);
    user.avatarDC.onmessage = user.onAvatarDCMessage.bind(user);

    user.userInfoDC = user.peerConnection.createDataChannel(userInfoChannelLabel);
    user.userInfoDC.onopen = user.onUserInfoDCOpen.bind(user);
    user.userInfoDC.onclose = user.onUserInfoDCClose.bind(user);
    user.userInfoDC.onmessage = user.onUserInfoDCMessage.bind(user);

    // emit an offer to the server to be broadcasted
    user.peerConnection
      .createOffer()
      .then((offer) => {
        return user.peerConnection.setLocalDescription(offer);
      })
      .then(() => {
        if (user.peerConnection.localDescription) {
          const offerPack = Pack({
            sdp: user.peerConnection.localDescription,
            senderId: socket.id,
            receiverId: user.id,
            kind: "offer",
          });
          socket.emit("OFFER", JSON.stringify(offerPack));
          onOfferSent(offerPack);
        }
      })
      .catch((e) => {
        console.error(e);
      });
  });
};

// open socketio listener for receiving WebRTC offers and sending answer
export const openOfferListener = (
  users: User[],
  socket: Socket,
  onOfferReceived: (Pack) => void = defaultOn,
  onAnswerEmitted: (Pack) => void = defaultOn
): void => {
  // emit an answer when offer is received
  socket.on("OFFER", (dataString) => {
    const offerPack = JSON.parse(dataString);
    const sender = findUserById(users, offerPack.senderId) as User;
    if (sender) {
      // set the local datachannel and event handlers on connect
      sender.peerConnection.ondatachannel = (event) => {
        const dc = event.channel;
        switch (dc.label) {
          case avatarChannelLabel: {
            sender.avatarDC = dc;
            sender.avatarDC.onopen = sender.onAvatarDCOpen.bind(sender);
            sender.avatarDC.onclose = sender.onAvatarDCClose.bind(sender);
            sender.avatarDC.onmessage = sender.onAvatarDCMessage.bind(sender);
            break;
          }
          case userInfoChannelLabel: {
            sender.userInfoDC = dc;
            sender.userInfoDC.onopen = sender.onUserInfoDCOpen.bind(sender);
            sender.userInfoDC.onclose = sender.onUserInfoDCClose.bind(sender);
            sender.userInfoDC.onmessage = sender.onUserInfoDCMessage.bind(sender);
            break;
          }
          default:
            break;
        }
      };
      onOfferReceived(offerPack);
      // identify and use RTCPeerConnection object for the sender user
      const peerConnection = sender.peerConnection;

      peerConnection
        .setRemoteDescription(offerPack.sdp) // set remote description as the sender's
        .then(() => {
          peerConnection
            .createAnswer()
            .then((answer) => {
              return peerConnection.setLocalDescription(answer);
            })
            .then(() => {
              if (peerConnection.localDescription) {
                // create the answer
                const answerPack = Pack({
                  sdp: peerConnection.localDescription,
                  senderId: socket.id,
                  receiverId: offerPack.senderId,
                  kind: "answer",
                });
                // send the answer
                socket.emit("ANSWER", JSON.stringify(answerPack));
                onAnswerEmitted(answerPack);
              }
            })
            .catch((e) => {
              console.error(e);
            });
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      console.error("Could not emit answer. Sender was not found on users list.");
    }
  });
};

// open socketio listener for receiving WebRTC answers
export const openAnswerListener = (
  users: User[],
  socket: Socket,
  onAnswerReceived: (Pack) => void = defaultOn
): void => {
  // set remote description once answer is recieved to establish connection
  socket.on("ANSWER", (dataString) => {
    const answerPack = JSON.parse(dataString);
    const user = findUserById(users, answerPack.senderId);
    const peerConnection = (user as User).peerConnection;
    peerConnection
      .setRemoteDescription(answerPack.sdp)
      .then(() => {
        onAnswerReceived(answerPack);
      })
      .catch((e) => {
        console.error(e);
      });
  });
};

// add user to the network
export const addUserToNetwork = (user: User): void => {
  users.push(user);
};

// remove user to the network
export const removeUserFromNetwork = (id: string): void => {
  const userIndex = users.findIndex((user) => user.id === id);
  if (users[userIndex]) {
    users.splice(userIndex, 1);
  }
};

// return user list
export const getUsers = (): User[] => {
  return users;
};

// find user by its socketid
export const findUserById = (users: User[], id: string): User => {
  const user = users.find((usr) => usr.id === id);
  return user as User;
};

// update tracks for all peer connections
export const updateAllTracks = (track: MediaStreamTrack): void => {
  users.forEach((user) => {
    user.updateRemoteTrack(track);
  });
};

// update information about the user such as avatar color, name, etc.
export const updateUserInfo = (info: UserInfo): void => {
  users.forEach((user) => {
    if (user.userInfoDC) {
      if (user.userInfoDC.readyState === "open") {
        user.userInfoDC.send(JSON.stringify(info));
      }
    }
  });
};

// update avatar positions for all peer connections
export const updateAvatarPositions = (pos: [number, number]): void => {
  users.forEach((user) => {
    user.setSelfPosition(pos);
    if (user.avatarDC) {
      if (user.avatarDC.readyState === "open") {
        user.avatarDC.send(JSON.stringify(pos));
      }
    }
  });
};