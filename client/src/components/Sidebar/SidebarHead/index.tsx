import { SIDEBAR_ITEM } from '../'
import { Person, ChatBubble } from "@material-ui/icons";
import SidebarButton from './SidebarButton'

const SidebarHead = ({ currentItem, setCurrentItem }: { currentItem: SIDEBAR_ITEM, setCurrentItem: (arg0: SIDEBAR_ITEM) => void }) => {
  return (
    <div className="sidebar--head">
      <SidebarButton value={SIDEBAR_ITEM.USERS} current={currentItem} setValue={setCurrentItem} content={<Person />} />
      <SidebarButton value={SIDEBAR_ITEM.CHAT} current={currentItem} setValue={setCurrentItem} content={<ChatBubble />} />
    </div>
  )
}

export default SidebarHead
