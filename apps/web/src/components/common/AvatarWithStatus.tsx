import React from 'react';
import { Avatar, Tooltip } from '@mui/material';
import { getInitials } from '../../utils/formatters';
import { getAvatarColor } from '../../utils/colors';

interface Props {
  uid:         string;
  displayName: string;
  photoURL?:   string | null;
  isOnline?:   boolean;
  size?:       number;
  showStatus?: boolean;
}

const AvatarWithStatus: React.FC<Props> = ({
  uid,
  displayName,
  photoURL,
  isOnline = false,
  size = 40,
  showStatus = true,
}) => {
  const bgColor = getAvatarColor(uid);

  return (
    <Tooltip title={displayName} placement="right" arrow>
      <div className="relative inline-flex flex-shrink-0" style={{ width: size, height: size }}>
        <Avatar
          src={photoURL ?? undefined}
          alt={displayName}
          sx={{
            width:    size,
            height:   size,
            bgcolor:  bgColor,
            fontSize: size * 0.38,
            fontWeight: 600,
          }}
        >
          {!photoURL && getInitials(displayName)}
        </Avatar>
        {showStatus && (
          <span
            className={`absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-gray-900 transition-colors ${
              isOnline ? 'bg-green-500' : 'bg-gray-400'
            }`}
            style={{ width: size * 0.28, height: size * 0.28 }}
            aria-label={isOnline ? 'Online' : 'Offline'}
          />
        )}
      </div>
    </Tooltip>
  );
};

export default AvatarWithStatus;
