/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useCookies } from "react-cookie";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import axios from "axios";

import Header from "./Header";
import SwipeCard from "./SwipeCard";
import ChatWindow from "./ChatWindow";
import ProfileDisplay from "./ProfileDisplay";
import ErrorBoundary from "../Error/ErrorBoundary";
import { NotFoundRight } from "./NotFound";

import { TABS } from "../../constants/constants";
import { changeTabUtils, handleSwipeEvent } from "../../utils/helper";

import {
  getAllChats,
  getAllMatches,
  getFilteredMatches,
  getSanitizedSuggestion,
  getAllLikes,
  getSanitizedProfiles,
} from "../../utils/getter";
import { getAxiosCall } from "../../utils/axiosUtil";
import { unmatchUtil, renderMatchUtil } from "../../utils/utils";

import {
  ChatContext,
  ProfileDisplayContext,
} from "../../context/dashboardContext";

import "./style/index.css";
import "./style/swipeCard.css";
import "./style/chatBox.css";

export default function DashboardComponent() {
  const [user, setUser] = useState(null);
  const [genderedUsers, setGenderedUsers] = useState([]);

  const [suggestion, setSuggestion] = useState({
    data: {
      displayPic: "",
      about: "",
      dob: "",
      pronouns: "She/Her",
      matchedID: "",
      first_name: "",
    },
    loading: true,
    showingLikedUserProfile: false,
    error: { isError: false, message: "" },
  });

  const [index, setIndex] = useState(1);
  const [tab, setTab] = useState(TABS.PROFILE);

  const [displayChat, setDisplayChat] = useState({
    data: [{ displayProfilePic: "", displayName: "", userID: null }],
    loading: false,
  });
  const [displayLikes, setDisplayLikes] = useState({
    data: [{ displayProfilePic: "", displayName: "", userID: null }],
    loading: true,
  });

  const [chatsDetails, setChatsDetails] = useState({
    displayProfilePic: "",
    displayName: "",
    messagesArray: [],
    status: "",
    matchedID: null,
  });

  const [cookies, setCookie, removeCookie] = useCookies(["user"]);
  const navigate = useNavigate();

  const fetcher = (url) =>
    axios({ method: "GET", url, params: { userId: cookies.UserId } }).then(
      (response) => response.data
    );

  const { data: likeData } = useSWR(
    `${process.env.REACT_APP_SERVER_URL}/likes`,
    fetcher,
    {
      refreshInterval: 1000,
    }
  );

  useEffect(() => {
    if (!likeData) return;
    if (likeData.length === 0) {
      return;
    }
    const revalidatedData = getSanitizedProfiles(likeData);
    setDisplayLikes(() => ({ data: revalidatedData, loading: false }));
  }, [likeData?.length]);

  const { data: matchData } = useSWR(
    `${process.env.REACT_APP_SERVER_URL}/matches`,
    fetcher,
    {
      refreshInterval: 1000,
    }
  );

  useEffect(() => {
    if (!matchData || matchData.length === 0) return;
    const revalidatedData = getSanitizedProfiles(matchData);
    setDisplayChat(() => ({ data: revalidatedData, loading: false }));
  }, [matchData?.length]);

  useEffect(() => {
    if (!cookies.UserId) navigate("/");
  }, [cookies.UserId]);

  const getUser = async () => {
    const { data, hasErrorOccurred } = await getAxiosCall({
      route: `/user`,
      params: { userId: cookies.UserId },
    });
    if (!hasErrorOccurred) setUser(data);
  };

  const getGenderedUsers = async () => {
    setSuggestion((prevState) => ({ ...prevState, loading: true }));
    const res = await getAxiosCall({
      route: `/gendered-users`,
      params: { userId: cookies.UserId, gender: user.gender_interest },
    });
    const { data, hasErrorOccurred } = res;
    if (!hasErrorOccurred) {
      setGenderedUsers(data);
      setSuggestion((prevState) => ({ ...prevState, loading: false }));
    }
  };

  useEffect(() => {
    getUser();
  }, [cookies.UserId]);

  useEffect(() => {
    if (user) {
      getGenderedUsers();
    }
  }, [cookies?.UserId, user?.gender_interest]);

  // TODO : complete this function

  const getMatches = async () => {
    setDisplayChat((prevState) => ({ ...prevState, loading: true }));
    if (!user) return;
    const data = await getAllMatches({
      userId: user.user_id,
      genderPref: user.gender_interest,
    });
    setDisplayChat(() => ({ data, loading: false }));
  };

  const getLikes = async () => {
    setDisplayLikes((prevState) => ({ ...prevState, loading: true }));
    if (!user) return;
    const data = await getAllLikes({ userId: user.user_id });
    setDisplayLikes(() => ({ data, loading: false }));
  };

  const filteredGenderedUsers = getFilteredMatches({
    user,
    genderedUsers,
  });

  useEffect(() => {
    getMatches();
  }, [user]);

  useEffect(() => {
    getLikes();
  }, [user]);

  useEffect(() => {
    if (filteredGenderedUsers.length > 0) {
      const data = getSanitizedSuggestion(filteredGenderedUsers[0]);
      setSuggestion((prevState) => ({
        ...prevState,
        loading: false,
        data,
        error: { isError: false, message: "" },
      }));
    }
  }, [filteredGenderedUsers[0]]);

  const handleChatClick = async (matchedID) => {
    if (!matchedID) return;
    const messagesArray = await getAllChats({
      senderID: cookies.UserId,
      recipientID: matchedID,
    });

    const getDetails =
      displayChat.data.find(
        (conversations) => conversations.userID === matchedID
      ) || {};

    if (Object.keys(getDetails) === 0) return;

    const { displayProfilePic, displayName, userID } = getDetails;

    setChatsDetails({
      displayProfilePic,
      displayName,
      status: "online",
      messagesArray: [...messagesArray],
      matchedID: userID,
    });
  };

  const changeTab = (event) => {
    const chooseTab = changeTabUtils({
      areChatsAvailable: displayChat.data.length,
      areChatsLoading: displayChat.loading,
      tab: event.target.attributes.iconName?.value,
    });
    if (chooseTab === TABS.CHATS) {
      if (displayChat.loading === true) return;
      if (displayChat.data[0]) handleChatClick(displayChat.data[0].userID);
    }
    setTab(chooseTab);
  };

  const handleRenderMatch = async (userId) => {
    setSuggestion((prevState) => ({
      ...prevState,
      loading: true,
      error: { isError: false, message: "" },
    }));
    const data = await renderMatchUtil({ userId });
    setSuggestion((prevState) => ({
      ...prevState,
      data,
      loading: false,
      showingLikedUserProfile: true,
    }));
  };

  const handleUnMatch = async (userID) => {
    const hasErrorOccurred = await unmatchUtil({
      userID: cookies.UserId,
      matchedID: userID,
    });
    if (hasErrorOccurred) return;
    setDisplayChat((prevDisplayMatches) => {
      const filteredMatches = prevDisplayMatches.data.filter(
        (match) => match.userID !== userID
      );
      return { ...prevDisplayMatches, data: filteredMatches };
    });
  };

  const handleSwipe = async (event, matchedID) => {
    if (suggestion.error.isError) return;
    const result = await handleSwipeEvent({
      event,
      index,
      lengthOfSugestionArray: filteredGenderedUsers.length,
      suggestion:
        suggestion.showingLikedUserProfile === false
          ? filteredGenderedUsers[index]
          : suggestion.data,
      userId: cookies.UserId,
      matchedUserId: matchedID,
      displayLikes,
    });
    if (!result) return;
    if (result.isError) {
      setSuggestion((prevState) => ({
        ...prevState,
        loading: false,
        showingLikedUserProfile: false,
        error: result,
      }));
      return;
    }

    if (suggestion.showingLikedUserProfile === false)
      setIndex((prevIndex) => prevIndex + 1);

    const data = getSanitizedSuggestion(filteredGenderedUsers[index]);
    if (!data) {
      setSuggestion((prevState) => ({
        ...prevState,
        loading: false,
        showingLikedUserProfile: false,
        error: {
          isError: true,
          message: "You have exceeded your limit! Please try again tomorrow.",
        },
      }));
      return;
    }
    setSuggestion((prevState) => ({
      ...prevState,
      loading: false,
      data,
      showingLikedUserProfile: false,
    }));
  };

  const handleLogOut = () => {
    removeCookie("UserId", cookies.UserId);
    removeCookie("AuthToken", cookies.AuthToken);
    navigate("/");
  };

  const handleChangePreference = () => {
    navigate("/onboarding");
  };

  useEffect(() => {
    // TODO : make a api call to fetch all the chats for the given userID
    setDisplayChat((prevState) => ({
      ...prevState,
      data: displayChat.data,
    }));
  }, [displayChat.data]);

  useEffect(() => {
    if (tab === TABS.CHATS && displayChat.data.length > 0)
      handleChatClick(displayChat.data[0].id);
  }, [displayChat.data, tab]);

  return (
    <div className="container">
      <div className="leftSide">
        <Header
          displayProfilePic={user?.image?.url ?? ""}
          handleClick={changeTab}
          tab={tab}
          handleLogOut={handleLogOut}
          handleChangePreference={handleChangePreference}
        />
        {tab === TABS.PROFILE && (
          <ProfileDisplayContext.Provider
            value={{
              matchedArray: displayLikes.data,
              handleProfileClick: handleRenderMatch,
              loader: displayLikes.loading,
              tab: TABS.PROFILE,
            }}
          >
            <ProfileDisplay />
          </ProfileDisplayContext.Provider>
        )}
        {tab === TABS.CHATS && (
          <ProfileDisplayContext.Provider
            value={{
              matchedArray: displayChat.data,
              handleProfileClick: handleChatClick,
              loader: displayChat.loading,
              tab: TABS.CHATS,
            }}
          >
            <ProfileDisplay />
          </ProfileDisplayContext.Provider>
        )}
      </div>
      {tab === TABS.PROFILE && suggestion.error.isError === false && (
        <SwipeCard
          displayPic={suggestion.data.displayPic}
          name={suggestion.data.first_name}
          age={suggestion.data.dob}
          pronouns={suggestion.data.pronouns}
          about={suggestion.data.about}
          handleSwipe={handleSwipe}
          matchedID={suggestion.data.matchedID}
          loading={suggestion.loading}
        />
      )}
      {tab === TABS.PROFILE && suggestion.error.isError && <NotFoundRight />}
      {tab === TABS.CHATS && (
        <ChatContext.Provider
          value={{
            ...chatsDetails,
            areChatsAvailable: displayChat.data.length,
            handleUnMatch,
          }}
        >
          <ErrorBoundary fallback="Error">
            <ChatWindow />
          </ErrorBoundary>
        </ChatContext.Provider>
      )}
    </div>
  );
}
